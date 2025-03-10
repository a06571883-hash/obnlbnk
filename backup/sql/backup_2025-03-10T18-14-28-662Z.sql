INSERT INTO users (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) VALUES
;

INSERT INTO cards (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) VALUES
;

INSERT INTO transactions (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) VALUES
;

INSERT INTO exchange_rates (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) VALUES
(1, 40.5, 65000, 3500, '2025-03-10T18:10:45.000Z'),
(2, 40.5, 65000, 3500, '2025-03-10T18:13:59.000Z'),
(3, 41.237005, 79163, 1936.41, '2025-03-10T18:14:00.000Z'),
(4, 40.5, 65000, 3500, '2025-03-10T18:14:27.000Z');
