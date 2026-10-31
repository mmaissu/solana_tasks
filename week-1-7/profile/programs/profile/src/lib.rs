use anchor_lang::prelude::*;

declare_id!("Bh6P5RE23VZGaAj5UF4LZ2QjGgc4kbpznXEVhPNiXv6p");

#[program]
pub mod profile {
    use super::*;

    pub fn create_profile(ctx: Context<CreateProfile>, name: String, bio: String) -> Result<()> {
        require!(name.len() <= 32, ProfileError::NameTooLong);
        require!(bio.len() <= 100, ProfileError::BioTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.user.key();
        profile.name = name;
        profile.bio = bio;
        profile.bump = ctx.bumps.profile;
        msg!("Profile created for {}", profile.authority);
        Ok(())
    }

    pub fn update_profile(ctx: Context<UpdateProfile>, name: String, bio: String) -> Result<()> {
        require!(name.len() <= 32, ProfileError::NameTooLong);
        require!(bio.len() <= 100, ProfileError::BioTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.name = name;
        profile.bio = bio;
        msg!("Profile updated");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Profile::INIT_SPACE,
        seeds = [b"profile", user.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump = profile.bump,
        has_one = authority
    )]
    pub profile: Account<'info, Profile>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(100)]
    pub bio: String,
    pub bump: u8,
}

#[error_code]
pub enum ProfileError {
    #[msg("Name is too long (max 32)")]
    NameTooLong,
    #[msg("Bio is too long (max 100)")]
    BioTooLong,
}