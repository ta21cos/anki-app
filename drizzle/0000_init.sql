CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` integer NOT NULL,
	`last_review` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_owner_deck_idx` ON `cards` (`owner_id`,`deck_id`);--> statement-breakpoint
CREATE INDEX `cards_owner_due_idx` ON `cards` (`owner_id`,`due`);--> statement-breakpoint
CREATE INDEX `cards_owner_state_idx` ON `cards` (`owner_id`,`state`);--> statement-breakpoint
CREATE INDEX `cards_owner_deck_due_idx` ON `cards` (`owner_id`,`deck_id`,`due`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`include_in_daily` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `decks_owner_idx` ON `decks` (`owner_id`);