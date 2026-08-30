import * as SQLite from 'expo-sqlite';

export type LocalShoot = {
  id: string;
  propertyName: string;
  address: string;
  createdAt: number;
  updatedAt: number;
};

export type LocalShootAsset = {
  id: string;
  shootId: string;
  uri: string;
  originalFilename: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('picchuspot-mobile.db').then(
      async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;

          CREATE TABLE IF NOT EXISTS shoots (
            id TEXT PRIMARY KEY NOT NULL,
            property_name TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS shoot_assets (
            id TEXT PRIMARY KEY NOT NULL,
            shoot_id TEXT NOT NULL,
            uri TEXT NOT NULL UNIQUE,
            original_filename TEXT,
            mime_type TEXT,
            width INTEGER,
            height INTEGER,
            sort_order INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (shoot_id)
              REFERENCES shoots(id)
              ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_shoot_assets_shoot_id
          ON shoot_assets(shoot_id);

          CREATE INDEX IF NOT EXISTS idx_shoot_assets_sort_order
          ON shoot_assets(shoot_id, sort_order);
        `);

        return database;
      },
    );
  }

  return databasePromise;
}

export async function createLocalShoot(
  propertyName: string,
  address: string,
): Promise<LocalShoot> {
  const database = await getDatabase();
  const now = Date.now();

  const shoot: LocalShoot = {
    id: createId('shoot'),
    propertyName: propertyName.trim(),
    address: address.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await database.runAsync(
    `
      INSERT INTO shoots (
        id,
        property_name,
        address,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      shoot.id,
      shoot.propertyName,
      shoot.address,
      shoot.createdAt,
      shoot.updatedAt,
    ],
  );

  return shoot;
}

export async function getLocalShoot(
  shootId: string,
): Promise<LocalShoot | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<{
    id: string;
    propertyName: string;
    address: string;
    createdAt: number;
    updatedAt: number;
  }>(
    `
      SELECT
        id,
        property_name AS propertyName,
        address,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM shoots
      WHERE id = ?
      LIMIT 1
    `,
    [shootId],
  );

  return row ?? null;
}

export async function getLocalShootAssets(
  shootId: string,
): Promise<LocalShootAsset[]> {
  const database = await getDatabase();

  return database.getAllAsync<LocalShootAsset>(
    `
      SELECT
        id,
        shoot_id AS shootId,
        uri,
        original_filename AS originalFilename,
        mime_type AS mimeType,
        width,
        height,
        sort_order AS sortOrder,
        created_at AS createdAt
      FROM shoot_assets
      WHERE shoot_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `,
    [shootId],
  );
}

type AddLocalShootAssetInput = {
  shootId: string;
  uri: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
};

export async function addLocalShootAsset(
  input: AddLocalShootAssetInput,
): Promise<LocalShootAsset> {
  const database = await getDatabase();

  const nextOrder = await database.getFirstAsync<{
    value: number;
  }>(
    `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS value
      FROM shoot_assets
      WHERE shoot_id = ?
    `,
    [input.shootId],
  );

  const now = Date.now();

  const asset: LocalShootAsset = {
    id: createId('asset'),
    shootId: input.shootId,
    uri: input.uri,
    originalFilename: input.originalFilename ?? null,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    sortOrder: nextOrder?.value ?? 0,
    createdAt: now,
  };

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `
        INSERT INTO shoot_assets (
          id,
          shoot_id,
          uri,
          original_filename,
          mime_type,
          width,
          height,
          sort_order,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        asset.id,
        asset.shootId,
        asset.uri,
        asset.originalFilename,
        asset.mimeType,
        asset.width,
        asset.height,
        asset.sortOrder,
        asset.createdAt,
      ],
    );

    await database.runAsync(
      `
        UPDATE shoots
        SET updated_at = ?
        WHERE id = ?
      `,
      [now, input.shootId],
    );
  });

  return asset;
}

export async function removeLocalShootAsset(
  assetId: string,
  shootId: string,
) {
  const database = await getDatabase();
  const now = Date.now();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `
        DELETE FROM shoot_assets
        WHERE id = ?
      `,
      [assetId],
    );

    await database.runAsync(
      `
        UPDATE shoots
        SET updated_at = ?
        WHERE id = ?
      `,
      [now, shootId],
    );
  });
}