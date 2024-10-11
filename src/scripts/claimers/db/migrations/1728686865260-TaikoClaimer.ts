import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaikoClaimer1728686865260 implements MigrationInterface {
  name = 'TaikoClaimer1728686865260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "Taiko" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "wallet_id" varchar(25) NOT NULL, "wallet_address" varchar(144) NOT NULL, "index" integer, "network" varchar(25) NOT NULL, "native_balance" float NOT NULL DEFAULT (0), "status" varchar(144) NOT NULL, "claim_amount" float NOT NULL DEFAULT (0), "balance" float NOT NULL DEFAULT (0), "transferred" float NOT NULL DEFAULT (0), "score" varchar(50) NOT NULL DEFAULT (\'\'), "error" varchar(1000))'
    );
    await queryRunner.query('CREATE INDEX "taiko_status" ON "Taiko" ("status") ');
    await queryRunner.query('CREATE INDEX "taiko_walletId" ON "Taiko" ("wallet_id") ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "taiko_walletId"');
    await queryRunner.query('DROP INDEX "taiko_status"');
    await queryRunner.query('DROP TABLE "Taiko"');
  }
}
