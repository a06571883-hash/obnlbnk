INSERT INTO users (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) VALUES
(1, 'regulator', '$2b$10$r3Ui7Wor6G7b2cGHEsrrNetitTiaXGfsqNcaMa/s3tkBPgMDn.7h2', true, 1000000.00000000, NULL, 0),
(2, 'user1', '$2b$10$o5n6DfN.bW3OHOPNDD08cu0iY.FbvYBFz0fr8P.T/JTjsFyUSGdL2', false, 0.00000000, NULL, 0);

INSERT INTO cards (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) VALUES
(1, 1, 'crypto', '40008886447333329', '01/28', '170', 0.00000000, 0.00100000, 0.01000000, '1CounterpartyXXXXXXXXXXXXXXXUWLpVr', '0xeBA5958D6C99f64dBd002b91D72423338402D903'),
(2, 1, 'usd', '41118694404182549', '07/28', '581', 1000.00000000, 0.00000000, 0.00000000, NULL, NULL),
(3, 1, 'uah', '55554834015910619', '06/28', '884', 40000.00000000, 0.00000000, 0.00000000, NULL, NULL),
(4, 2, 'crypto', '40001291745348822', '12/28', '702', 0.00000000, 0.00100000, 0.01000000, '1BitcoinEaterAddressDontSendf59kuE', '0x0BE46E41DAe1a8179c5CAcff127C52eeDB9dA444'),
(5, 2, 'usd', '41114259491253544', '09/28', '271', 1000.00000000, 0.00000000, 0.00000000, NULL, NULL),
(6, 2, 'uah', '55554221079290175', '03/28', '112', 40000.00000000, 0.00000000, 0.00000000, NULL, NULL);

INSERT INTO transactions (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) VALUES
;

INSERT INTO exchange_rates (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) VALUES
(1, 41.22, 84811.00, 2141.72, '2025-03-09T11:32:05.579Z'),
(2, 41.22, 84748.00, 2140.67, '2025-03-09T11:32:19.795Z'),
(3, 41.22, 84748.00, 2140.67, '2025-03-09T11:32:49.198Z'),
(4, 41.22, 84748.00, 2140.67, '2025-03-09T11:33:16.017Z'),
(5, 41.22, 84748.00, 2140.67, '2025-03-09T11:33:45.567Z'),
(6, 41.22, 84748.00, 2140.67, '2025-03-09T11:34:15.568Z'),
(7, 41.22, 84748.00, 2140.67, '2025-03-09T11:34:45.569Z');
