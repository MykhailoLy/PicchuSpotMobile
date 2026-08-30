import * as SQLite from 'expo-sqlite';

export type LocalShoot = {
  id: string;
  propertyName: string;
  address: string;
  createdAt: number;
  updatedAt: number;
};

export type LocalShootSummary = LocalShoot & {
  photoCount: number;
  coverPhotoUri: string | null;
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

export type LocalShootSnapshot = {
  shoot: LocalShoot;
  assets: LocalShootAsset[];
};

export type AddLocalShootAssetInput = {
  uri: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
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

function assertPropertyName(propertyName: string) {
  const trimmedName = propertyName.trim();

  if (!trimmedName) {
    throw new Error('A shoot name is required.');
  }

  return trimmedName;
}

export async function createLocalShoot(
  propertyName: string,
  address: string,
): Promise<LocalShoot> {
  const database = await getDatabase();
  const now = Date.now();

  const shoot: LocalShoot = {
    id: createId('shoot'),
    propertyName: assertPropertyName(propertyName),
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

export async function getLocalShoots(): Promise<LocalShootSummary[]> {
  const database = await getDatabase();

  return database.getAllAsync<LocalShootSummary>(`
    SELECT
      shoots.id,
      shoots.property_name AS propertyName,
      shoots.address,
      shoots.created_at AS createdAt,
      shoots.updated_at AS updatedAt,
      COUNT(shoot_assets.id) AS photoCount,
      (
        SELECT cover.uri
        FROM shoot_assets AS cover
        WHERE cover.shoot_id = shoots.id
        ORDER BY cover.sort_order ASC, cover.created_at ASC
        LIMIT 1
      ) AS coverPhotoUri
    FROM shoots
    LEFT JOIN shoot_assets
      ON shoot_assets.shoot_id = shoots.id
    GROUP BY shoots.id
    ORDER BY shoots.updated_at DESC, shoots.created_at DESC
  `);
}

export async function getLocalShoot(
  shootId: string,
): Promise<LocalShoot | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<LocalShoot>(
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

export async function addLocalShootAssets(
  shootId: string,
  inputs: AddLocalShootAssetInput[],
): Promise<LocalShootAsset[]> {
  if (inputs.length === 0) {
    return [];
  }

  const database = await getDatabase();
  const createdAssets: LocalShootAsset[] = [];

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const shoot = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM shoots WHERE id = ? LIMIT 1',
      [shootId],
    );

    if (!shoot) {
      throw new Error('Shoot not found.');
    }

    const nextOrder = await transaction.getFirstAsync<{ value: number }>(
      `
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS value
        FROM shoot_assets
        WHERE shoot_id = ?
      `,
      [shootId],
    );

    const firstSortOrder = nextOrder?.value ?? 0;
    const now = Date.now();

    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index];
      const asset: LocalShootAsset = {
        id: createId('asset'),
        shootId,
        uri: input.uri,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        sortOrder: firstSortOrder + index,
        createdAt: now + index,
      };

      await transaction.runAsync(
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

      createdAssets.push(asset);
    }

    await transaction.runAsync(
      `
        UPDATE shoots
        SET updated_at = ?
        WHERE id = ?
      `,
      [now, shootId],
    );
  });

  return createdAssets;
}

export async function addLocalShootAsset(
  input: AddLocalShootAssetInput & { shootId: string },
): Promise<LocalShootAsset> {
  const [asset] = await addLocalShootAssets(input.shootId, [input]);

  return asset;
}

export async function removeLocalShootAsset(
  assetId: string,
  shootId: string,
): Promise<LocalShootAsset | null> {
  const database = await getDatabase();
  let removedAsset: LocalShootAsset | null = null;

  await database.withExclusiveTransactionAsync(async (transaction) => {
    removedAsset = await transaction.getFirstAsync<LocalShootAsset>(
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
        WHERE id = ? AND shoot_id = ?
        LIMIT 1
      `,
      [assetId, shootId],
    );

    if (!removedAsset) {
      return;
    }

    await transaction.runAsync(
      'DELETE FROM shoot_assets WHERE id = ? AND shoot_id = ?',
      [assetId, shootId],
    );

    await transaction.runAsync(
      'UPDATE shoots SET updated_at = ? WHERE id = ?',
      [Date.now(), shootId],
    );
  });

  return removedAsset;
}

export async function restoreLocalShootAsset(asset: LocalShootAsset) {
  const database = await getDatabase();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
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

    await transaction.runAsync(
      'UPDATE shoots SET updated_at = ? WHERE id = ?',
      [Date.now(), asset.shootId],
    );
  });
}

export async function renameLocalShoot(
  shootId: string,
  propertyName: string,
): Promise<LocalShoot> {
  const database = await getDatabase();
  const updatedAt = Date.now();

  const result = await database.runAsync(
    `
      UPDATE shoots
      SET property_name = ?, updated_at = ?
      WHERE id = ?
    `,
    [assertPropertyName(propertyName), updatedAt, shootId],
  );

  if (result.changes === 0) {
    throw new Error('Shoot not found.');
  }

  const shoot = await getLocalShoot(shootId);

  if (!shoot) {
    throw new Error('Shoot not found after rename.');
  }

  return shoot;
}

export async function deleteLocalShoot(
  shootId: string,
): Promise<LocalShootSnapshot | null> {
  const database = await getDatabase();
  let snapshot: LocalShootSnapshot | null = null;

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const shoot = await transaction.getFirstAsync<LocalShoot>(
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

    if (!shoot) {
      return;
    }

    const assets = await transaction.getAllAsync<LocalShootAsset>(
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

    snapshot = { shoot, assets };

    await transaction.runAsync(
      'DELETE FROM shoot_assets WHERE shoot_id = ?',
      [shootId],
    );
    await transaction.runAsync('DELETE FROM shoots WHERE id = ?', [shootId]);
  });

  return snapshot;
}

export async function restoreLocalShoot(snapshot: LocalShootSnapshot) {
  const database = await getDatabase();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
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
        snapshot.shoot.id,
        snapshot.shoot.propertyName,
        snapshot.shoot.address,
        snapshot.shoot.createdAt,
        snapshot.shoot.updatedAt,
      ],
    );

    for (const asset of snapshot.assets) {
      await transaction.runAsync(
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
    }
  });
}
