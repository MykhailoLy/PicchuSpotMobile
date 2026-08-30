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

function ensureShootsDirectory() {
  shootsDirectory.create({
    idempotent: true,
    intermediates: true,
  });
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

  const randomPart = Math.random()
    .toString(36)
    .slice(2, 10);

  return `${Date.now()}-${randomPart}.${extension}`;
}

export async function persistShootImage(
  shootId: string,
  input: PersistImageInput,
) {
  ensureShootsDirectory();

  const shootDirectory = new Directory(
    shootsDirectory,
    shootId,
  );

  shootDirectory.create({
    idempotent: true,
    intermediates: true,
  });

  const sourceFile = new File(input.uri);

  const destinationFile = new File(
    shootDirectory,
    createFileName(input),
  );

  await sourceFile.copy(destinationFile);

  return destinationFile.uri;
}

export function deletePersistedShootImage(uri: string) {
  const file = new File(uri);

  if (file.exists) {
    file.delete();
  }
}