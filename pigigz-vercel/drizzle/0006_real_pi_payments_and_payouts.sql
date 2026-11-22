ALTER TABLE `users` ADD COLUMN `wallet_address` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `pi_payment_id` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `pi_txid` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_status` text DEFAULT 'simulated' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payout_id` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payout_txid` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payout_status` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payout_idempotency_key` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payout_error` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payout_idempotency_key_unique` ON `orders` (`payout_idempotency_key`);
--> statement-breakpoint
CREATE TABLE `payment_intents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`buyer_pi_uid` text NOT NULL,
	`buyer_name` text NOT NULL,
	`gig_id` integer,
	`offer_id` integer,
	`brief` text NOT NULL,
	`amount_pi` real NOT NULL,
	`commission_pi` real NOT NULL,
	`seller_net_pi` real NOT NULL,
	`seller_pi_uid` text,
	`pi_payment_id` text,
	`pi_txid` text,
	`status` text DEFAULT 'awaiting_payment' NOT NULL,
	`order_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_intents_pi_payment_id_unique` ON `payment_intents` (`pi_payment_id`);
