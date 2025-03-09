INSERT INTO users (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) VALUES
;

INSERT INTO cards (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) VALUES
;

INSERT INTO transactions (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) VALUES
;

INSERT INTO exchange_rates (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) VALUES
(1, 41.22, 84811.00, 2141.72, '2025-03-09T11:32:05.579Z'),
(2, 41.22, 84748.00, 2140.67, '2025-03-09T11:32:19.795Z'),
(3, 41.22, 84748.00, 2140.67, '2025-03-09T11:32:49.198Z'),
(4, 41.22, 84748.00, 2140.67, '2025-03-09T11:33:16.017Z');
