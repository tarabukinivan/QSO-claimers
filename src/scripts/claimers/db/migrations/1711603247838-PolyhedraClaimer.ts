import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolyhedraClaimer1711603247838 implements MigrationInterface {
  name = 'PolyhedraClaimer1711603247838';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "Polyhedra" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "wallet_id" varchar(25) NOT NULL, "wallet_address" varchar(144) NOT NULL, "index" integer, "network" varchar(25) NOT NULL, "native_balance" float NOT NULL DEFAULT (0), "status" varchar(144) NOT NULL, "claim_amount" float NOT NULL DEFAULT (0), "balance" float NOT NULL DEFAULT (0), "transferred" float NOT NULL DEFAULT (0), "transferred_to" varchar(144), "gas_spent" float, "error" varchar(1000))'
    );
    await queryRunner.query('CREATE INDEX "polyhedra_status" ON "Polyhedra" ("status") ');
    await queryRunner.query('CREATE INDEX "polyhedra_walletId" ON "Polyhedra" ("wallet_id") ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "polyhedra_walletId"');
    await queryRunner.query('DROP INDEX "polyhedra_status"');
    await queryRunner.query('DROP TABLE "Polyhedra"');
  }
}
