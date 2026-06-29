CREATE TABLE `fills` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`taker_id` text NOT NULL,
	`stake` real NOT NULL,
	`locked_yes_price` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taker_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_unique` ON `groups` (`invite_code`);--> statement-breakpoint
CREATE TABLE `markets` (
	`ticker` text PRIMARY KEY NOT NULL,
	`event_ticker` text,
	`title` text NOT NULL,
	`yes_bid` real NOT NULL,
	`yes_ask` real NOT NULL,
	`status` text NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`close_ts` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`market_ticker` text NOT NULL,
	`maker_id` text NOT NULL,
	`side` text NOT NULL,
	`max_risk` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_ticker`) REFERENCES `markets`(`ticker`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maker_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
