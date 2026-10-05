(() => {
  const form = document.getElementById('job-form');
  if (!form) return;
  const camera = document.getElementById('camera_photo');
  const gallery = document.getElementById('gallery_photo');
  const note = document.getElementById('photo-note');
  const button = document.getElementById('submit-application');
  const limit = 200 * 1024;

  camera.addEventListener('change', () => { if (camera.files.length) gallery.value = ''; });
  gallery.addEventListener('change', () => { if (gallery.files.length) camera.value = ''; });

  function canvasBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function reducePhoto(file) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      let side = 1000;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await canvasBlob(canvas, 0.72);
        if (blob && blob.size <= limit) return new File([blob], 'applicant-photo.jpg', { type: 'image/jpeg' });
        side = Math.round(side * 0.75);
      }
      throw new Error('Photo is too large. Please choose another photo.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  form.addEventListener('submit', async (event) => {
    const input = camera.files.length ? camera : gallery.files.length ? gallery : null;
    if (!input) return;
    event.preventDefault();
    button.disabled = true;
    note.classList.remove('photo-error');
    note.textContent = 'Preparing your photo…';
    try {
      const photo = await reducePhoto(input.files[0]);
      const transfer = new DataTransfer();
      transfer.items.add(photo);
      input.files = transfer.files;
      note.textContent = 'Photo ready. Sending your application…';
      form.submit();
    } catch {
      note.classList.add('photo-error');
      note.textContent = 'Could not prepare that photo. Try a JPEG, PNG or another camera photo.';
      button.disabled = false;
    }
  });
})();
