export async function uploadToImgBB(file: File): Promise<{ url: string }> {
  try {
    const apiKey = (import.meta as any).env?.VITE_IMGBB_API_KEY || '2d23c10a4a8722421375d0137452d9a9';
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ImgBB upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.data && (data.data.url || data.data.display_url)) {
      return { url: data.data.url || data.data.display_url };
    }
    throw new Error(data?.error?.message || 'Không thể lấy URL ảnh từ ImgBB');
  } catch (error: any) {
    console.error('Error in uploadToImgBB:', error);
    throw error;
  }
}
