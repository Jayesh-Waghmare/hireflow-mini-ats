CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`stage` text NOT NULL,
	`location` text NOT NULL,
	`skills` text NOT NULL,
	`experience` integer NOT NULL,
	`notes` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`history` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_owner_email_unique` ON `candidates` (`owner`,`email`);