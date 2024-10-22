import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScrollClaimer1729544507213 implements MigrationInterface {
  name = 'ScrollClaimer1729544507213';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "Scroll" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "wallet_id" varchar(25) NOT NULL, "wallet_address" varchar(144) NOT NULL, "index" integer, "network" varchar(25) NOT NULL, "native_balance" float NOT NULL DEFAULT (0), "status" varchar(144) NOT NULL, "claim_amount" float NOT NULL DEFAULT (0), "balance" float NOT NULL DEFAULT (0), "transferred" float NOT NULL DEFAULT (0), "marks" varchar(50) NOT NULL DEFAULT (\'\'), "error" varchar(1000))'
    );
    await queryRunner.query('CREATE INDEX "scroll_status" ON "Scroll" ("status") ');
    await queryRunner.query('CREATE INDEX "scroll_walletId" ON "Scroll" ("wallet_id") ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "scroll_walletId"');
    await queryRunner.query('DROP INDEX "scroll_status"');
    await queryRunner.query('DROP TABLE "Scroll"');
  }
}
