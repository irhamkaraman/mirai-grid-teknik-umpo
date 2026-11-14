import httpx
import logging

logger = logging.getLogger("miraigrid.simtik")

BASE_URL = "https://simtik.umpo.ac.id"
LOGIN_URL = f"{BASE_URL}/apps/action/login.user.php"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

async def verify_simtik(nim: str, password: str) -> dict:
    """
    Simulasi Reverse Login Handshake browser ke SIMTIK UMPO (portal tunggal https://simtik.umpo.ac.id/).
    Mendukung login Mahasiswa (NIM <= 8 digit) maupun Dosen (Username / NIDN).
    1. 2x GET ke https://simtik.umpo.ac.id/ untuk mengumpulkan session & challenge cookies (Nginx & PHP).
    2. POST application/x-www-form-urlencoded ke https://simtik.umpo.ac.id/apps/action/login.user.php
       dengan follow_redirects=False (manual redirect).
    3. Evaluasi status HTTP (301, 302, 303) & konten SweetAlert.
    """
    clean_user = nim.strip()
    if not clean_user or not password:
        return {"success": False, "message": "NIM / Username / NIDN dan Password SIMTIK wajib diisi."}

    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=False, timeout=12.0) as client:
            for _ in range(2):
                await client.get(
                    f"{BASE_URL}/",
                    headers={
                        "User-Agent": USER_AGENT,
                        "Referer": f"{BASE_URL}/",
                    },
                )

            form_data = {
                "userid": clean_user,
                "passwd": password,
                "level": "mhs",
                "lokasi_gps": "",
                "lat_long": "",
            }
            headers = {
                "User-Agent": USER_AGENT,
                "Referer": f"{BASE_URL}/",
                "Origin": BASE_URL,
                "Content-Type": "application/x-www-form-urlencoded",
            }

            res = await client.post(LOGIN_URL, data=form_data, headers=headers)
            html_text = res.text

            fail_keywords = ["Login Gagal", "User tidak ditemukan", "Password salah", "icon: 'error'", 'icon: "error"']
            if any(k in html_text for k in fail_keywords):
                if "User tidak ditemukan" in html_text:
                    return {"success": False, "message": "Akun tidak terdaftar di SIMTIK UMPO."}
                if "Password salah" in html_text:
                    return {"success": False, "message": "Password SIMTIK salah."}
                return {"success": False, "message": "NIM / Username / NIDN atau Password SIMTIK salah."}

            if res.status_code >= 400:
                return {"success": False, "message": "NIM / Username / NIDN atau Password SIMTIK salah."}

            success_keywords = ["Login Berhasil", "icon: 'success'", 'icon: "success"', "window.location"]
            location = (res.headers.get("location") or "").lower()
            is_redirect_success = res.status_code in (301, 302, 303) and "gagal" not in location and "error" not in location
            is_success = is_redirect_success or any(k in html_text for k in success_keywords)

            if is_success:
                return {
                    "success": True,
                    "message": "Login SIMTIK Berhasil",
                    "nim": clean_user,
                    "username": clean_user,
                    "nama": clean_user,
                }

            return {"success": False, "message": "Otentikasi ditolak oleh server SIMTIK UMPO."}

    except httpx.TimeoutException:
        logger.error(f"Koneksi ke SIMTIK timeout untuk {clean_user}")
        return {"success": False, "message": "Koneksi ke server SIMTIK UMPO timeout (periksa jaringan kampus)."}
    except Exception as e:
        logger.error(f"Kesalahan jaringan SIMTIK: {str(e)}")
        return {"success": False, "message": f"Kesalahan jaringan ke server SIMTIK: {str(e)}"}
