import { api } from './client'

export async function launchJupyterLab(customApi = api) {
  const popup = window.open('', `miraigrid_jupyter_${Date.now()}`)

  try {
    const { data } = await customApi.post('/jupyter/sso-launch')

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = data.action_url
    form.target = popup ? popup.name : '_blank'
    form.style.display = 'none'

    Object.entries(data.fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = String(value)
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
    setTimeout(() => {
      try {
        if (form.parentNode) {
          document.body.removeChild(form)
        }
      } catch (e) {}
    }, 1000)
    return data
  } catch (error) {
    if (popup) {
      popup.close()
    }
    throw error
  }
}
