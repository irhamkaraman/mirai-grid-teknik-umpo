/**
 * Konversi angka ukuran (dalam MB) ke format satuan yang mudah dibaca (MB, GB, TB)
 * @param {number} sizeInMB Angka kapasitas dalam satuan Megabyte
 * @param {number} decimals Jumlah angka di belakang koma (default: 1)
 * @returns {string}
 */
export function formatMBSize(sizeInMB, decimals = 1) {
  const num = Number(sizeInMB);
  if (!num || isNaN(num) || num <= 0) return '0 MB';

  // Jika mencapai atau melebihi 1 TB (1024 * 1024 MB)
  if (num >= 1048576) {
    const tb = num / 1048576;
    return `${parseFloat(tb.toFixed(decimals))} TB`;
  }

  // Jika mencapai atau melebihi 1 GB (1024 MB)
  if (num >= 1024) {
    const gb = num / 1024;
    return `${parseFloat(gb.toFixed(decimals))} GB`;
  }

  // Jika masih di bawah 1 GB
  return `${parseFloat(num.toFixed(decimals))} MB`;
}
