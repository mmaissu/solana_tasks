export const IDL = {
  "address": "25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4",
  "metadata": {
    "name": "simple_vault",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "close_raydium_position",
      "docs": [
        "Закрыть позицию в Raydium CLMM через CPI.",
        "Выводит всю ликвидность обратно в vault, сжигает position NFT."
      ],
      "discriminator": [
        162,
        208,
        2,
        192,
        141,
        142,
        245,
        58
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "vault_state",
          "docs": [
            "Владелец NFT; при закрытии получает rent за NFT и personal_position"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "second_mint"
        },
        {
          "name": "vault_second_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  101,
                  99,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "second_mint"
              }
            ]
          }
        },
        {
          "name": "pool_state",
          "writable": true
        },
        {
          "name": "protocol_position",
          "writable": true
        },
        {
          "name": "position_nft_mint",
          "writable": true
        },
        {
          "name": "position_nft_account",
          "docs": [
            "NFT позиции лежит у vault_state"
          ],
          "writable": true
        },
        {
          "name": "personal_position",
          "writable": true
        },
        {
          "name": "token_vault_0",
          "writable": true
        },
        {
          "name": "token_vault_1",
          "writable": true
        },
        {
          "name": "tick_array_lower",
          "writable": true
        },
        {
          "name": "tick_array_upper",
          "writable": true
        },
        {
          "name": "vault_0_mint"
        },
        {
          "name": "vault_1_mint"
        },
        {
          "name": "clmm_program",
          "address": "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "token_program_2022",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "memo_program",
          "address": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount_0_min",
          "type": "u64"
        },
        {
          "name": "amount_1_min",
          "type": "u64"
        }
      ]
    },
    {
      "name": "close_user_card",
      "docs": [
        "Закрыть карточку пользователя, рента возвращается владельцу."
      ],
      "discriminator": [
        48,
        156,
        133,
        38,
        191,
        116,
        165,
        94
      ],
      "accounts": [
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "collect_fees",
      "docs": [
        "Собрать комиссии позиции (decrease_liquidity_v2 с liquidity = 0). Только админ."
      ],
      "discriminator": [
        164,
        152,
        207,
        99,
        30,
        186,
        19,
        182
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "vault_state",
          "docs": [
            "Владелец NFT; при закрытии получает rent за NFT и personal_position"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "second_mint"
        },
        {
          "name": "vault_second_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  101,
                  99,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "second_mint"
              }
            ]
          }
        },
        {
          "name": "pool_state",
          "writable": true
        },
        {
          "name": "protocol_position",
          "writable": true
        },
        {
          "name": "position_nft_mint",
          "writable": true
        },
        {
          "name": "position_nft_account",
          "docs": [
            "NFT позиции лежит у vault_state"
          ],
          "writable": true
        },
        {
          "name": "personal_position",
          "writable": true
        },
        {
          "name": "token_vault_0",
          "writable": true
        },
        {
          "name": "token_vault_1",
          "writable": true
        },
        {
          "name": "tick_array_lower",
          "writable": true
        },
        {
          "name": "tick_array_upper",
          "writable": true
        },
        {
          "name": "vault_0_mint"
        },
        {
          "name": "vault_1_mint"
        },
        {
          "name": "clmm_program",
          "address": "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "token_program_2022",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "memo_program",
          "address": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "create_user_card",
      "docs": [
        "Создать личную карточку пользователя в vault."
      ],
      "discriminator": [
        25,
        67,
        231,
        22,
        28,
        170,
        76,
        39
      ],
      "accounts": [
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "docs": [
        "Пользователь вносит `amount` токенов → получает shares.",
        "",
        "Формула:",
        "Первый депозит:       shares = amount  (1:1)",
        "Последующие депозиты: shares = amount * total_shares / total_tokens"
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "docs": [
            "Vault token account — принимает токены"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "share_mint",
          "docs": [
            "Share mint — vault чеканит shares"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_token_account",
          "docs": [
            "Токен-аккаунт пользователя (источник токенов)"
          ],
          "writable": true
        },
        {
          "name": "user_share_account",
          "docs": [
            "Share-аккаунт пользователя (получает shares)"
          ],
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "init_second_storage",
      "docs": [
        "Админ создаёт второе хранилище vault (для второго токена пула)."
      ],
      "discriminator": [
        227,
        185,
        38,
        114,
        83,
        11,
        136,
        151
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "second_mint"
        },
        {
          "name": "vault_second_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  101,
                  99,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "second_mint"
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize_vault",
      "docs": [
        "Создать vault для конкретного SPL-токена.",
        "Создаёт: VaultState PDA, vault_token_account PDA, share_mint PDA."
      ],
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "vault_state",
          "docs": [
            "VaultState PDA — seeds: [\"vault\", token_mint]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "docs": [
            "Token account, принадлежащий vault PDA — хранит депозиты пользователей"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "share_mint",
          "docs": [
            "Mint для shares — выпускается vault PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "token_mint",
          "docs": [
            "SPL-токен, который принимает vault (например, USDC или тестовый токен)"
          ]
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "open_raydium_position",
      "docs": [
        "Открыть позицию в Raydium CLMM через CPI.",
        "Vault PDA = владелец NFT позиции.",
        "Токены берутся из vault_token_account (первый токен) и vault_second_account (второй)."
      ],
      "discriminator": [
        20,
        240,
        112,
        208,
        102,
        129,
        214,
        240
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Админ: подписывает и платит rent за NFT, personal_position и tick arrays"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "second_mint"
        },
        {
          "name": "vault_second_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  101,
                  99,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "second_mint"
              }
            ]
          }
        },
        {
          "name": "pool_state",
          "writable": true
        },
        {
          "name": "protocol_position",
          "writable": true
        },
        {
          "name": "position_nft_mint",
          "docs": [
            "Новый keypair, Raydium создаёт из него mint NFT"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "position_nft_account",
          "writable": true
        },
        {
          "name": "personal_position",
          "writable": true
        },
        {
          "name": "tick_array_lower",
          "writable": true
        },
        {
          "name": "tick_array_upper",
          "writable": true
        },
        {
          "name": "token_vault_0",
          "writable": true
        },
        {
          "name": "token_vault_1",
          "writable": true
        },
        {
          "name": "vault_0_mint"
        },
        {
          "name": "vault_1_mint"
        },
        {
          "name": "clmm_program",
          "address": "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "token_program_2022",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "tick_lower_index",
          "type": "i32"
        },
        {
          "name": "tick_upper_index",
          "type": "i32"
        },
        {
          "name": "tick_array_lower_start_index",
          "type": "i32"
        },
        {
          "name": "tick_array_upper_start_index",
          "type": "i32"
        },
        {
          "name": "liquidity",
          "type": "u128"
        },
        {
          "name": "amount_0_max",
          "type": "u64"
        },
        {
          "name": "amount_1_max",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_paused",
      "docs": [
        "Админ ставит vault на паузу или снимает её."
      ],
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "vault_state"
          ]
        },
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "swap",
      "docs": [
        "Админ меняет токены vault через CLMM-пул Raydium (CPI, подписывает vault PDA)."
      ],
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Только админ может запускать обмен"
          ],
          "signer": true
        },
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "vault_input_account",
          "docs": [
            "Откуда vault отдаёт токен (владелец — vault PDA)"
          ],
          "writable": true
        },
        {
          "name": "vault_output_account",
          "docs": [
            "Куда vault получает токен (владелец — vault PDA)"
          ],
          "writable": true
        },
        {
          "name": "amm_config"
        },
        {
          "name": "pool_state",
          "writable": true
        },
        {
          "name": "input_vault",
          "writable": true
        },
        {
          "name": "output_vault",
          "writable": true
        },
        {
          "name": "observation_state",
          "writable": true
        },
        {
          "name": "input_vault_mint"
        },
        {
          "name": "output_vault_mint"
        },
        {
          "name": "clmm_program",
          "address": "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "token_program_2022",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "memo_program",
          "address": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        }
      ],
      "args": [
        {
          "name": "amount_in",
          "type": "u64"
        },
        {
          "name": "minimum_amount_out",
          "type": "u64"
        },
        {
          "name": "sqrt_price_limit_x64",
          "type": "u128"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Пользователь сжигает `shares_amount` shares → получает токены обратно.",
        "",
        "Формула: tokens = shares * total_tokens / total_shares"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "docs": [
            "Vault token account — отправляет токены пользователю"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "share_mint",
          "docs": [
            "Share mint — сжигает shares"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault_state.token_mint",
                "account": "VaultState"
              }
            ]
          }
        },
        {
          "name": "user_token_account",
          "docs": [
            "Токен-аккаунт пользователя (получает токены)"
          ],
          "writable": true
        },
        {
          "name": "user_share_account",
          "docs": [
            "Share-аккаунт пользователя (источник shares для сжигания)"
          ],
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "shares_amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PersonalPositionState",
      "discriminator": [
        70,
        111,
        150,
        126,
        230,
        15,
        25,
        117
      ]
    },
    {
      "name": "UserCard",
      "discriminator": [
        99,
        156,
        133,
        85,
        192,
        58,
        202,
        10
      ]
    },
    {
      "name": "VaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ZeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "SharesTooSmall",
      "msg": "Shares would be zero — deposit too small"
    },
    {
      "code": 6002,
      "name": "WithdrawTooSmall",
      "msg": "Withdraw amount too small"
    },
    {
      "code": 6003,
      "name": "VaultEmpty",
      "msg": "Vault is empty"
    },
    {
      "code": 6004,
      "name": "MathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6005,
      "name": "Unauthorized",
      "msg": "Unauthorized: only admin can call this"
    },
    {
      "code": 6006,
      "name": "InvalidTickRange",
      "msg": "tick_lower must be less than tick_upper"
    },
    {
      "code": 6007,
      "name": "VaultPaused",
      "msg": "Vault is paused"
    },
    {
      "code": 6008,
      "name": "CardHasShares",
      "msg": "Card still has shares: withdraw first"
    },
    {
      "code": 6009,
      "name": "SwapOutputTooLow",
      "msg": "Swap output is below minimum_amount_out"
    },
    {
      "code": 6010,
      "name": "InvalidPoolMints",
      "msg": "Pool mints do not match vault tokens"
    }
  ],
  "types": [
    {
      "name": "PersonalPositionState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "Bump to identify PDA"
            ],
            "type": "u8"
          },
          {
            "name": "nft_mint",
            "docs": [
              "Mint address of the tokenized position"
            ],
            "type": "pubkey"
          },
          {
            "name": "pool_id",
            "docs": [
              "The ID of the pool with which this token is connected"
            ],
            "type": "pubkey"
          },
          {
            "name": "tick_lower_index",
            "docs": [
              "The lower bound tick of the position"
            ],
            "type": "i32"
          },
          {
            "name": "tick_upper_index",
            "docs": [
              "The upper bound tick of the position"
            ],
            "type": "i32"
          },
          {
            "name": "liquidity",
            "docs": [
              "The amount of liquidity owned by this position"
            ],
            "type": "u128"
          },
          {
            "name": "fee_growth_inside_0_last_x64",
            "docs": [
              "The token_0 fee growth of the aggregate position as of the last action on the individual position"
            ],
            "type": "u128"
          },
          {
            "name": "fee_growth_inside_1_last_x64",
            "docs": [
              "The token_1 fee growth of the aggregate position as of the last action on the individual position"
            ],
            "type": "u128"
          },
          {
            "name": "token_fees_owed_0",
            "docs": [
              "The fees owed to the position owner in token_0, as of the last computation"
            ],
            "type": "u64"
          },
          {
            "name": "token_fees_owed_1",
            "docs": [
              "The fees owed to the position owner in token_1, as of the last computation"
            ],
            "type": "u64"
          },
          {
            "name": "reward_infos",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "PositionRewardInfo"
                  }
                },
                3
              ]
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                8
              ]
            }
          }
        ]
      }
    },
    {
      "name": "PositionRewardInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "growth_inside_last_x64",
            "type": "u128"
          },
          {
            "name": "reward_amount_owed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "UserCard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "VaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "token_mint",
            "type": "pubkey"
          },
          {
            "name": "vault_token_account",
            "type": "pubkey"
          },
          {
            "name": "share_mint",
            "type": "pubkey"
          },
          {
            "name": "total_tokens",
            "type": "u64"
          },
          {
            "name": "total_shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    }
  ]
} as const
