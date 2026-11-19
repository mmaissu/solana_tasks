use anchor_lang::prelude::*;
use anchor_spl::memo::Memo;
use anchor_spl::token::Token;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{Mint, TokenAccount};
use raydium_clmm_cpi::{cpi, states::PersonalPositionState};

use crate::{VaultError, VaultState};

/// Аккаунты для сбора комиссий и закрытия позиции vault в Raydium CLMM.
/// NFT позиции принадлежит vault_state, поэтому CPI подписывает vault PDA.
#[derive(Accounts)]
pub struct ManageRaydiumPosition<'info> {
    pub admin: Signer<'info>,

    /// Владелец NFT; при закрытии получает rent за NFT и personal_position
    #[account(
        mut,
        seeds = [b"vault", vault_state.token_mint.as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.admin == admin.key() @ VaultError::Unauthorized,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

    #[account(
        mut,
        seeds = [b"vault_tokens", vault_state.token_mint.as_ref()],
        bump,
        token::mint = vault_state.token_mint,
        token::authority = vault_state,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub second_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"vault_second", vault_state.key().as_ref(), second_mint.key().as_ref()],
        bump,
        token::mint = second_mint,
        token::authority = vault_state,
    )]
    pub vault_second_account: Box<InterfaceAccount<'info, TokenAccount>>,

    // ---- Raydium CLMM ----
    /// CHECK: пул, проверяет Raydium
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: устаревший PDA, адрес из SDK getPdaProtocolPositionAddress
    #[account(mut)]
    pub protocol_position: UncheckedAccount<'info>,

    #[account(mut)]
    pub position_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// NFT позиции лежит у vault_state
    #[account(
        mut,
        token::mint = position_nft_mint,
        token::authority = vault_state,
    )]
    pub position_nft_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = personal_position.pool_id == pool_state.key(),
    )]
    pub personal_position: Box<Account<'info, PersonalPositionState>>,

    /// CHECK: хранилище пула token0, проверяет Raydium
    #[account(mut)]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: хранилище пула token1, проверяет Raydium
    #[account(mut)]
    pub token_vault_1: UncheckedAccount<'info>,

    /// CHECK: проверяет Raydium
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,

    /// CHECK: проверяет Raydium
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,

    pub vault_0_mint: Box<InterfaceAccount<'info, Mint>>,
    pub vault_1_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: адрес программы CLMM
    #[account(address = raydium_clmm_cpi::id())]
    pub clmm_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
    pub memo_program: Program<'info, Memo>,
    pub system_program: Program<'info, System>,
}

/// Хранилища vault в порядке токенов пула (token0, token1)
fn recipients<'info>(
    a: &ManageRaydiumPosition<'info>,
) -> Result<(AccountInfo<'info>, AccountInfo<'info>)> {
    let first_mint = a.vault_state.token_mint;
    let second_mint = a.second_mint.key();
    let m0 = a.vault_0_mint.key();
    let m1 = a.vault_1_mint.key();
    let first = a.vault_token_account.to_account_info();
    let second = a.vault_second_account.to_account_info();
    if m0 == first_mint && m1 == second_mint {
        Ok((first, second))
    } else if m0 == second_mint && m1 == first_mint {
        Ok((second, first))
    } else {
        err!(VaultError::InvalidPoolMints)
    }
}

/// Балансы (первый токен, второй токен)
fn balances(a: &ManageRaydiumPosition) -> (u64, u64) {
    (a.vault_token_account.amount, a.vault_second_account.amount)
}

/// CPI decrease_liquidity_v2: выводит liquidity и забирает начисленные комиссии
fn decrease_liquidity<'info>(
    a: &ManageRaydiumPosition<'info>,
    remaining: Vec<AccountInfo<'info>>,
    liquidity: u128,
    amount_0_min: u64,
    amount_1_min: u64,
) -> Result<()> {
    let (r0, r1) = recipients(a)?;
    let first_mint = a.vault_state.token_mint;
    let bump = a.vault_state.bump;
    let seeds: &[&[&[u8]]] = &[&[b"vault", first_mint.as_ref(), &[bump]]];

    let accounts = cpi::accounts::DecreaseLiquidityV2 {
        nft_owner: a.vault_state.to_account_info(),
        nft_account: a.position_nft_account.to_account_info(),
        personal_position: a.personal_position.to_account_info(),
        pool_state: a.pool_state.to_account_info(),
        protocol_position: a.protocol_position.to_account_info(),
        token_vault_0: a.token_vault_0.to_account_info(),
        token_vault_1: a.token_vault_1.to_account_info(),
        tick_array_lower: a.tick_array_lower.to_account_info(),
        tick_array_upper: a.tick_array_upper.to_account_info(),
        recipient_token_account_0: r0,
        recipient_token_account_1: r1,
        token_program: a.token_program.to_account_info(),
        token_program_2022: a.token_program_2022.to_account_info(),
        memo_program: a.memo_program.to_account_info(),
        vault_0_mint: a.vault_0_mint.to_account_info(),
        vault_1_mint: a.vault_1_mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(a.clmm_program.to_account_info(), accounts, seeds)
        .with_remaining_accounts(remaining);
    cpi::decrease_liquidity_v2(cpi_ctx, liquidity, amount_0_min, amount_1_min)
}

/// Собрать комиссии, не меняя позицию: liquidity = 0, минимумы = 0
pub fn collect_fees_handler<'a, 'b, 'c: 'info, 'info>(
    mut ctx: Context<'a, 'b, 'c, 'info, ManageRaydiumPosition<'info>>,
) -> Result<()> {
    let (f0, s0) = balances(ctx.accounts);
    let remaining = ctx.remaining_accounts.to_vec();

    decrease_liquidity(ctx.accounts, remaining, 0, 0, 0)?;

    ctx.accounts.vault_token_account.reload()?;
    ctx.accounts.vault_second_account.reload()?;
    let (f1, s1) = balances(ctx.accounts);
    msg!(
        "Fees collected: first_token={}, second_token={}",
        f1.saturating_sub(f0),
        s1.saturating_sub(s0)
    );
    Ok(())
}

/// Закрыть позицию: вывести всю ликвидность (с минимумами) и сжечь NFT.
/// amount_0_min / amount_1_min - в порядке токенов пула (token0, token1).
pub fn close_handler<'a, 'b, 'c: 'info, 'info>(
    mut ctx: Context<'a, 'b, 'c, 'info, ManageRaydiumPosition<'info>>,
    amount_0_min: u64,
    amount_1_min: u64,
) -> Result<()> {
    let liquidity = ctx.accounts.personal_position.liquidity;
    let (f0, s0) = balances(ctx.accounts);
    let remaining = ctx.remaining_accounts.to_vec();

    // 1. Вывести всю ликвидность и остаток комиссий (вызываем и при liquidity = 0,
    //    чтобы обнулить начисленные комиссии - иначе close_position откажет)
    decrease_liquidity(ctx.accounts, remaining, liquidity, amount_0_min, amount_1_min)?;

    // 2. Закрыть позицию (сжечь NFT Token-2022, rent уходит vault_state)
    let a = &ctx.accounts;
    let first_mint = a.vault_state.token_mint;
    let bump = a.vault_state.bump;
    let seeds: &[&[&[u8]]] = &[&[b"vault", first_mint.as_ref(), &[bump]]];
    let close_accounts = cpi::accounts::ClosePosition {
        nft_owner: a.vault_state.to_account_info(),
        position_nft_mint: a.position_nft_mint.to_account_info(),
        position_nft_account: a.position_nft_account.to_account_info(),
        personal_position: a.personal_position.to_account_info(),
        system_program: a.system_program.to_account_info(),
        token_program: a.token_program_2022.to_account_info(),
    };
    cpi::close_position(CpiContext::new_with_signer(
        a.clmm_program.to_account_info(),
        close_accounts,
        seeds,
    ))?;

    ctx.accounts.vault_token_account.reload()?;
    ctx.accounts.vault_second_account.reload()?;
    let (f1, s1) = balances(ctx.accounts);
    msg!(
        "Position closed: liquidity={}, returned first_token={}, second_token={}",
        liquidity,
        f1.saturating_sub(f0),
        s1.saturating_sub(s0)
    );
    Ok(())
}
