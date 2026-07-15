ALTER TABLE `groups` ADD `kind` text DEFAULT 'room' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `share_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `offers_share_code_unique` ON `offers` (`share_code`);
