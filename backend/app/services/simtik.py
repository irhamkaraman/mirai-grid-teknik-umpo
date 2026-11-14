import httpx
import logging

logger = logging.getLogger("miraigrid.simtik")

BASE_URL = "https://simtik.umpo.ac.id"
LOGIN_URL = f"{BASE_URL}/apps/action/login.user.php"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

async def _verify_simtik_portal(
    username: str,
    password: str,
    *,
    portal_path: str,
    login_endpoint: str,
    level: str,
    account_label: str,
    default_name_prefix: str,
    extra_fields: dict | None = None,
) -> dict:
    """
    Shared Reverse Login Handshake browser ke portal SIMTIK UMPO.
    1. 2x GET ke portal_url untuk mengumpulkan session & challenge cookies (Nginx & PHP).
    2. POST application/x-www-form-urlencoded ke login_endpoint dengan follow_redirects=False.
    3. Evaluasi status HTTP (301, 302, 303), error HTTP (>= 400), & konten SweetAlert.
    """
    clean_user = username.strip()
    if not clean_user or not password:
        return {"success": False, "message": f"{account_label} dan Password wajib diisi."}

    portal_url = f"{BASE_URL}{portal_path}"
    login_url = f"{BASE_URL}{login_endpoint}"

    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=False, timeout=12.0) as client:
            for _ in range(2):
                await client.get(
                    portal_url,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Referer": portal_url,
                    },
                )

            form_data = {
                "userid": clean_user,
                "passwd": password,
                "level": level,
            }
            if extra_fields:
                form_data.update(extra_fields)

            headers = {
                "User-Agent": USER_AGENT,
                "Referer": portal_url,
                "Origin": BASE_URL,
                "Content-Type": "application/x-www-form-urlencoded",
            }

            res = await client.post(login_url, data=form_data, headers=headers)
            html_text = res.text

            fail_keywords = ["Login Gagal", "User tidak ditemukan", "Password salah", "icon: 'error'", 'icon: "error"']
            if any(k in html_text for k in fail_keywords):
                if "User tidak ditemukan" in html_text:
                    return {"success": False, "message": f"{account_label} tidak terdaftar di SIMTIK UMPO."}
                if "Password salah" in html_text:
                    return {"success": False, "message": "Password SIMTIK salah."}
                return {"success": False, "message": f"{account_label} atau Password SIMTIK salah."}

            if res.status_code >= 400:
                logger.warning(f"SIMTIK {level} login returned HTTP {res.status_code} for {clean_user}")
                return {"success": False, "message": f"{account_label} atau Password SIMTIK salah."}

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
                    "nama": f"{default_name_prefix} {clean_user}",
                }

            return {"success": False, "message": "Otentikasi ditolak oleh server SIMTIK UMPO."}

    except httpx.TimeoutException:
        logger.error(f"Koneksi ke SIMTIK ({level}) timeout untuk {clean_user}")
        return {"success": False, "message": "Koneksi ke server SIMTIK UMPO timeout (periksa jaringan kampus)."}
    except Exception as e:
        logger.error(f"Kesalahan jaringan SIMTIK ({level}): {str(e)}")
        return {"success": False, "message": f"Kesalahan jaringan ke server SIMTIK: {str(e)}"}


async def verify_simtik(nim: str, password: str) -> dict:
    """Autentikasi akun mahasiswa melalui portal https://simtik.umpo.ac.id/."""
    return await _verify_simtik_portal(
        nim,
        password,
        portal_path="/",
        login_endpoint="/apps/action/login.user.php",
        level="mhs",
        account_label="NIM",
        default_name_prefix="Mahasiswa",
        extra_fields={"lokasi_gps": "", "lat_long": ""},
    )


async def verify_simtik_dosen(username: str, password: str) -> dict:
    """Autentikasi akun dosen melalui portal https://simtik.umpo.ac.id/dosen/."""
    return await _verify_simtik_portal(
        username,
        password,
        portal_path="/dosen/",
        login_endpoint="/apps/action/login.dosen.php",
        level="dosen",
        account_label="NIDN / Username Dosen",
        default_name_prefix="Dosen",
    )
