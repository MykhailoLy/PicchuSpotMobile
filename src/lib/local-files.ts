import { Directory, File, Paths } from 'expo-file-system';

type PersistImageInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const shootsDirectory = new Directory(
  Paths.document,
  'picchuspot',
  'shoots',
);

function assertSafeShootId(shootId: string) {
  if (!/^shoot_[a-zA-Z0-9_-]+$/.test(shootId)) {
    throw new Error('Invalid local shoot identifier.');
  }
}

function getShootDirectory(shootId: string) {
  assertSafeShootId(shootId);

  return new Directory(shootsDirectory, shootId);
}

function ensureShootDirectory(shootId: string) {
  shootsDirectory.create({
    idempotent: true,
    intermediates: true,
  });

  const shootDirectory = getShootDirectory(shootId);

  shootDirectory.create({
    idempotent: true,
    intermediates: true,
  });

  return shootDirectory;
}

function getExtension(input: PersistImageInput) {
  const fileName = input.fileName ?? input.uri.split('/').pop() ?? '';
  const extensionMatch = fileName.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);

  if (extensionMatch?.[1]) {
    return extensionMatch[1].toLowerCase();
  }

  switch (input.mimeType) {
    case 'image/png':
      return 'png';

    case 'image/webp':
      return 'webp';

    case 'image/heic':
    case 'image/heif':
      return 'heic';

    default:
      return 'jpg';
  }
}

function createFileName(input: PersistImageInput) {
  const extension = getExtension(input);
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${Date.now()}-${randomPart}.${extension}`;
}

function getOwnedShootFile(shootId: string, uri: string) {
  const shootDirectory = getShootDirectory(shootId);
  const normalizedRoot = Paths.normalize(shootDirectory.uri);
  const file = new File(uri);
  const normalizedFileUri = Paths.normalize(file.uri);
  const rootPrefix = normalizedRoot.endsWith('/')
    ? normalizedRoot
    : `${normalizedRoot}/`;

  if (!normalizedFileUri.startsWith(rootPrefix)) {
    throw new Error('Refusing to modify a file outside this shoot.');
  }

  return file;
}

export async function persistShootImage(
  shootId: string,
  input: PersistImageInput,
) {
  const shootDirectory = ensureShootDirectory(shootId);
  const sourceFile = new File(input.uri);
  const destinationFile = new File(
    shootDirectory,
    createFileName(input),
  );

  try {
    await sourceFile.copy(destinationFile);
  } catch (error) {
    if (destinationFile.exists) {
      destinationFile.delete();
    }

    throw error;
  }

  return destinationFile.uri;
}

export function deletePersistedShootImage(shootId: string, uri: string) {
  const file = getOwnedShootFile(shootId, uri);

  if (file.exists) {
    file.delete();
  }
}

export function deletePersistedShootDirectory(shootId: string) {
  const shootDirectory = getShootDirectory(shootId);

  if (shootDirectory.exists) {
    shootDirectory.delete();
  }
}
