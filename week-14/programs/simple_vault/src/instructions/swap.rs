use anchor_lang::prelude::*;
use anchor_spl::memo::Memo;
use anchor_spl::token::{Mint as SplMint, Token, TokenAccount as SplTokenAccount};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::TokenAccount;
use raydium_clmm_cpi::cpi;

use crate::{VaultError, VaultState};

// ─────────────────────────────────────────────────────────────────────────────
// Второе хранилище vault (для второго токена пула)
// ─────────────────────────────────────────────────────────────────────────────

/// Админ создаёт token account vault для второго токена пула.
/// Адрес: PDA ["vault_second", vault_state, second_mint], владелец — vault PDA.
#[derive(Accounts)]
pub struct InitSecondStorage<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"vault", vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.admin == admin.key() @ VaultError::Unauthorized,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub second_mint: Account<'info, SplMint>,

    #[account(
        init,
        payer = admin,
        token::mint = second_mint,
        token::authority = vault_state,
        seeds = [b"vault_second", vault_state.key().as_ref(), second_mint.key().as_ref()],
        bump,
    )]
    pub vault_second_account: Account<'info, SplTokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn init_second_storage_handler(ctx: Context<InitSecondStorage>) -> Result<()> {
    msg!(
        "Second storage created: {} (mint {})",
        ctx.accounts.vault_second_account.key(),
        ctx.accounts.second_mint.key()
    );
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Обмен через Raydium CLMM (swap_v2) — только админ
// ─────────────────────────────────────────────────────────────────────────────

/// Vault отдаёт токен из vault_input_account и получает другой токен в vault_output_account.
/// Подписывает обмен PDA vault_state (он владелец обоих token account и payer в CPI).
#[derive(Accounts)]
pub struct SwapVault<'info> {
    /// Только админ может запускать обмен
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"vault", vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.admin == admin.key() @ VaultError::Unauthorized,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Откуда vault отдаёт токен (владелец — vault PDA)
    #[account(mut, token::authority = vault_state)]
    pub vault_input_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Куда vault получает токен (владелец — vault PDA)
    #[account(mut, token::authority = vault_state)]
    pub vault_output_account: Box<InterfaceAccount<'info, TokenAccount>>,

    // ─── Raydium CLMM аккаунты (валидирует сам Raydium) ──────────────────

    /// CHECK: валидируется Raydium
    pub amm_config: UncheckedAccount<'info>,

    /// CHECK: валидируется Raydium
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: vault пула для входного токена, валидируется Raydium
    #[account(mut)]
    pub input_vault: UncheckedAccount<'info>,

    /// CHECK: vault пула для выходного токена, валидируется Raydium
    #[account(mut)]
    pub output_vault: UncheckedAccount<'info>,

    /// CHECK: валидируется Raydium
    #[account(mut)]
    pub observation_state: UncheckedAccount<'info>,

    /// CHECK: mint входного токена, валидируется Raydium
    pub input_vault_mint: UncheckedAccount<'info>,

    /// CHECK: mint выходного токена, валидируется Raydium
    pub output_vault_mint: UncheckedAccount<'info>,

    /// CHECK: проверяется через address = raydium_clmm_cpi::id()
    #[account(address = raydium_clmm_cpi::id())]
    pub clmm_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
    pub memo_program: Program<'info, Memo>,
    // remaining_accounts: tick arrays пула в порядке прохода обмена
}

pub fn swap_handler<'a, 'b, 'c: 'info, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, SwapVault<'info>>,
    amount_in: u64,
    minimum_amount_out: u64,
    sqrt_price_limit_x64: u128,
) -> Result<()> {
    require!(amount_in > 0, VaultError::ZeroAmount);
    // Защита от slippage обязательна: минимум не может быть нулевым
    require!(minimum_amount_out > 0, VaultError::ZeroAmount);

    let token_mint_key = ctx.accounts.vault_state.token_mint;
    let bump = ctx.accounts.vault_state.bump;
    let vault_seeds: &[&[&[u8]]] = &[&[b"vault", token_mint_key.as_ref(), &[bump]]];

    let out_before = ctx.accounts.vault_output_account.amount;

    let cpi_accounts = cpi::accounts::SwapSingleV2 {
        payer: ctx.accounts.vault_state.to_account_info(), // PDA vault подписывает как владелец input-счёта
        amm_config: ctx.accounts.amm_config.to_account_info(),
        pool_state: ctx.accounts.pool_state.to_account_info(),
        input_token_account: ctx.accounts.vault_input_account.to_account_info(),
        output_token_account: ctx.accounts.vault_output_account.to_account_info(),
        input_vault: ctx.accounts.input_vault.to_account_info(),
        output_vault: ctx.accounts.output_vault.to_account_info(),
        observation_state: ctx.accounts.observation_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
        memo_program: ctx.accounts.memo_program.to_account_info(),
        input_vault_mint: ctx.accounts.input_vault_mint.to_account_info(),
        output_vault_mint: ctx.accounts.output_vault_mint.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clmm_program.to_account_info(),
        cpi_accounts,
        vault_seeds,
    )
    .with_remaining_accounts(ctx.remaining_accounts.to_vec());

    // is_base_input = true: amount_in — точная сумма на входе,
    // minimum_amount_out — минимум на выходе (иначе Raydium отменит обмен)
    cpi::swap_v2(cpi_ctx, amount_in, minimum_amount_out, sqrt_price_limit_x64, true)?;

    // Собственная проверка: сколько vault реально получил
    ctx.accounts.vault_output_account.reload()?;
    let received = ctx
        .accounts
        .vault_output_account
        .amount
        .checked_sub(out_before)
        .ok_or(VaultError::MathOverflow)?;
    require!(received >= minimum_amount_out, VaultError::SwapOutputTooLow);

    msg!("Swap: in={} out={} (min_out={})", amount_in, received, minimum_amount_out);
    Ok(())
}