use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Token;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Approve, Mint, Revoke, TokenAccount};
use raydium_clmm_cpi::cpi;

use crate::{VaultError, VaultState};

/// Открыть позицию в Raydium CLMM на средства vault.
/// Первый токен (vault_state.token_mint) берётся из vault_token_account,
/// второй - из vault_second_account. NFT позиции (Token-2022) получает vault_state.
#[derive(Accounts)]
pub struct OpenRaydiumPosition<'info> {
    /// Админ: подписывает и платит rent за NFT, personal_position и tick arrays
    #[account(mut)]
    pub admin: Signer<'info>,

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

    /// Новый keypair, Raydium создаёт из него mint NFT
    #[account(mut)]
    pub position_nft_mint: Signer<'info>,

    /// CHECK: ATA (Token-2022) vault_state для NFT, создаёт Raydium
    #[account(mut)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: PDA ["position", nft_mint], создаёт Raydium
    #[account(mut)]
    pub personal_position: UncheckedAccount<'info>,

    /// CHECK: проверяет Raydium
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,

    /// CHECK: проверяет Raydium
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,

    /// CHECK: хранилище пула token0, проверяет Raydium
    #[account(mut)]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: хранилище пула token1, проверяет Raydium
    #[account(mut)]
    pub token_vault_1: UncheckedAccount<'info>,

    pub vault_0_mint: Box<InterfaceAccount<'info, Mint>>,
    pub vault_1_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: адрес программы CLMM
    #[account(address = raydium_clmm_cpi::id())]
    pub clmm_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler<'a, 'b, 'c: 'info, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, OpenRaydiumPosition<'info>>,
    tick_lower_index: i32,
    tick_upper_index: i32,
    tick_array_lower_start_index: i32,
    tick_array_upper_start_index: i32,
    liquidity: u128,
    amount_0_max: u64,
    amount_1_max: u64,
) -> Result<()> {
    require!(tick_lower_index < tick_upper_index, VaultError::InvalidTickRange);
    require!(liquidity > 0, VaultError::ZeroAmount);

    let first_mint = ctx.accounts.vault_state.token_mint;
    let second_mint = ctx.accounts.second_mint.key();
    let mint_0 = ctx.accounts.vault_0_mint.key();
    let mint_1 = ctx.accounts.vault_1_mint.key();

    // Какой из токенов vault в пуле token0
    let first_is_0 = if mint_0 == first_mint && mint_1 == second_mint {
        true
    } else if mint_0 == second_mint && mint_1 == first_mint {
        false
    } else {
        return err!(VaultError::InvalidPoolMints);
    };

    let first_info = ctx.accounts.vault_token_account.to_account_info();
    let second_info = ctx.accounts.vault_second_account.to_account_info();
    let (token_account_0, token_account_1) = if first_is_0 {
        (first_info.clone(), second_info.clone())
    } else {
        (second_info.clone(), first_info.clone())
    };
    let (first_max, second_max) = if first_is_0 {
        (amount_0_max, amount_1_max)
    } else {
        (amount_1_max, amount_0_max)
    };

    let bump = ctx.accounts.vault_state.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", first_mint.as_ref(), &[bump]]];
    let vault_info = ctx.accounts.vault_state.to_account_info();
    let admin_info = ctx.accounts.admin.to_account_info();
    let token_prog = ctx.accounts.token_program.to_account_info();

    // 1. Raydium списывает токены от имени payer (admin).
    //    Vault временно разрешает админу потратить не больше лимитов.
    token_interface::approve(
        CpiContext::new_with_signer(
            token_prog.clone(),
            Approve { to: first_info.clone(), delegate: admin_info.clone(), authority: vault_info.clone() },
            signer_seeds,
        ),
        first_max,
    )?;
    token_interface::approve(
        CpiContext::new_with_signer(
            token_prog.clone(),
            Approve { to: second_info.clone(), delegate: admin_info.clone(), authority: vault_info.clone() },
            signer_seeds,
        ),
        second_max,
    )?;

    // 2. CPI: открыть позицию, NFT получает vault_state
    let cpi_accounts = cpi::accounts::OpenPositionWithToken22Nft {
        payer: admin_info.clone(),
        position_nft_owner: vault_info.clone(),
        position_nft_mint: ctx.accounts.position_nft_mint.to_account_info(),
        position_nft_account: ctx.accounts.position_nft_account.to_account_info(),
        pool_state: ctx.accounts.pool_state.to_account_info(),
        protocol_position: ctx.accounts.protocol_position.to_account_info(),
        tick_array_lower: ctx.accounts.tick_array_lower.to_account_info(),
        tick_array_upper: ctx.accounts.tick_array_upper.to_account_info(),
        personal_position: ctx.accounts.personal_position.to_account_info(),
        token_account_0,
        token_account_1,
        token_vault_0: ctx.accounts.token_vault_0.to_account_info(),
        token_vault_1: ctx.accounts.token_vault_1.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: token_prog.clone(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
        vault_0_mint: ctx.accounts.vault_0_mint.to_account_info(),
        vault_1_mint: ctx.accounts.vault_1_mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clmm_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    )
    .with_remaining_accounts(ctx.remaining_accounts.to_vec());

    cpi::open_position_with_token22_nft(
        cpi_ctx,
        tick_lower_index,
        tick_upper_index,
        tick_array_lower_start_index,
        tick_array_upper_start_index,
        liquidity,
        amount_0_max,
        amount_1_max,
        false, // with_metadata: не нужно, дешевле rent
        None,  // base_flag: используем liquidity из SDK, amount_*_max - лимиты
    )?;

    // 3. Отозвать разрешение
    token_interface::revoke(CpiContext::new_with_signer(
        token_prog.clone(),
        Revoke { source: first_info, authority: vault_info.clone() },
        signer_seeds,
    ))?;
    token_interface::revoke(CpiContext::new_with_signer(
        token_prog,
        Revoke { source: second_info, authority: vault_info },
        signer_seeds,
    ))?;

    msg!(
        "Position opened: ticks {}..{}, liquidity={}, max0={}, max1={}",
        tick_lower_index, tick_upper_index, liquidity, amount_0_max, amount_1_max
    );
    Ok(())
}