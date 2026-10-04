let driveAccessToken: string | null = null;

export function getDriveAccessToken(): string | null {
  return driveAccessToken || localStorage.getItem('google_drive_access_token');
}

export async function signInWithGoogleForDrive(): Promise<string> {
  const savedToken = localStorage.getItem('google_drive_access_token');
  if (savedToken) {
    driveAccessToken = savedToken;
    return savedToken;
  }
  throw new Error('Chưa đăng nhập Google Drive. Vui lòng cấu hình token.');
}

export async function uploadFileToGoogleDrive(file: File): Promise<{ previewUrl: string; fileId?: string }> {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('Chưa có token truy cập Google Drive');
  }

  const metadata = {
    name: file.name,
    mimeType: file.type,
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Tải file lên Google Drive thất bại (${res.status})`);
  }

  const data = await res.json();
  const fileId = data.id;
  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  return { previewUrl, fileId };
}
