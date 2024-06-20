import { MigrationInterface, QueryRunner } from 'typeorm';

export class LayerZero1718875049692 implements MigrationInterface {
  name = 'LayerZero1718875049692';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "LayerZero" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "wallet_id" varchar(25) NOT NULL, "wallet_address" varchar(144) NOT NULL, "index" integer, "network" varchar(25) NOT NULL, "native_balance" float NOT NULL DEFAULT (0), "status" varchar(144) NOT NULL, "claim_amount" float NOT NULL DEFAULT (0), "balance" float NOT NULL DEFAULT (0), "transferred" float NOT NULL DEFAULT (0), "transferred_to" varchar(144), "gas_spent" float, "error" varchar(1000))'
    );
    await queryRunner.query('CREATE INDEX "layerZero_status" ON "LayerZero" ("status") ');
    await queryRunner.query('CREATE INDEX "layerZero_walletId" ON "LayerZero" ("wallet_id") ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "layerZero_walletId"');
    await queryRunner.query('DROP INDEX "layerZero_status"');
    await queryRunner.query('DROP TABLE "LayerZero"');
  }
}
