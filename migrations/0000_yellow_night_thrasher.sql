CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"expiry" text NOT NULL,
	"cvv" text NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"btc_address" text,
	"eth_address" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"is_regulator" boolean DEFAULT false NOT NULL,
	"regulator_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
