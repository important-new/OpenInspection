ALTER TABLE `users` ADD `terms_accepted` text;
-- intentionally empty (drizzle drift artifact; applied everywhere as a no-op — do not delete: the journal references it)