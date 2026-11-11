import httpx
import logging

logger = logging.getLogger("miraigrid.simtik")

BASE_URL = "https://simtik.umpo.ac.id"
LOGIN_URL = f"{BASE_URL}/apps/action/login.user.php"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

async def verify_simtik(nim: str, password: str) -> dict:
    """
    Simulasi Reverse Login Handshake browser ke SIMTIK UMPO.
    1. 2x GET ke https://simtik.umpo.ac.id/ untuk mengumpulkan session & challenge cookies (Nginx & PHP).
    2. POST application/x-www-form-urlencoded ke https://simtik.umpo.ac.id/apps/action/login.user.php
       dengan follow_redirects=False (manual redirect).
    3. Evaluasi status HTTP (301, 302, 303) & konten SweetAlert.
    """
    clean_nim = nim.strip()
    if not clean_nim or not password:
        return {"success": False, "message": "NIM dan Password wajib diisi."}

    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=False, timeout=12.0) as client:
            # 1. Handshake awal: 2x GET untuk cookie Nginx & PHP
            for i in range(2):
                await client.get(
                    f"{BASE_URL}/",
                    headers={
                        "User-Agent": USER_AGENT,
                        "Referer": f"{BASE_URL}/"
                    }
                )

            # 2. Kirim Form Login POST
            form_data = {
                "userid": clean_nim,
                "passwd": password,
                "level": "mhs",
                "lokasi_gps": "",
                "lat_long": ""
            }
            headers = {
                "User-Agent": USER_AGENT,
                "Referer": f"{BASE_URL}/",
                "Origin": BASE_URL,
                "Content-Type": "application/x-www-form-urlencoded"
            }

            res = await client.post(LOGIN_URL, data=form_data, headers=headers)
            html_text = res.text

            # 3. Cek apakah SIMTIK menolak
            fail_keywords = ["Login Gagal", "User tidak ditemukan", "Password salah", "icon: 'error'", 'icon: "error"']
            if any(k in html_text for k in fail_keywords):
                if "User tidak ditemukan" in html_text:
                    return {"success": False, "message": "NIM tidak terdaftar di SIMTIK UMPO."}
                if "Password salah" in html_text:
                    return {"success": False, "message": "Password SIMTIK salah."}
                return {"success": False, "message": "NIM atau Password SIMTIK salah."}

            # 4. Cek apakah SIMTIK menerima (301, 302, 303 Redirect atau SweetAlert sukses)
            success_keywords = ["Login Berhasil", "icon: 'success'", 'icon: "success"', "window.location"]
            is_success = (
                res.status_code in (301, 302, 303) or
                any(k in html_text for k in success_keywords)
            )

            if is_success:
                return {
                    "success": True,
                    "message": "Login SIMTIK Berhasil",
                    "nim": clean_nim,
                    "nama": f"Mahasiswa {clean_nim}"
                }

            return {"success": False, "message": "Otentikasi ditolak oleh server SIMTIK UMPO."}

    except httpx.TimeoutException:
        logger.error(f"Koneksi ke SIMTIK timeout untuk NIM {clean_nim}")
        return {"success": False, "message": "Koneksi ke server SIMTIK UMPO timeout (periksa jaringan kampus)."}
    except Exception as e:
        logger.error(f"Kesalahan jaringan SIMTIK: {str(e)}")
        return {"success": False, "message": f"Kesalahan jaringan ke server SIMTIK: {str(e)}"}
