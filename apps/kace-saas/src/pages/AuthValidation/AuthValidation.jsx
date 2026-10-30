import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../cognito-auth/AuthContext"
import { useSelector } from "react-redux"
import LoadingPage from "../../components/core/LoaderPage/LoginLoaderPage"

const AuthValidation = () => {

  const navigate = useNavigate()

  const { isAuthenticated, userInformation } = useAuth()

  const configAdmin = useSelector((state) => state.generalSetup.configAdmin)

  useEffect(() => {
    if (!isAuthenticated) return

    if (isAuthenticated && userInformation?.user?.selectedGroup) {
      navigate("/dashboard")
    }
  }, [configAdmin, isAuthenticated])

    return (
      <div className="flex flex-col items-center justify-center h-screen" >
        <LoadingPage message="Configurando la aplicación, por favor espere..." />
      </div>
    )
  
}

export default AuthValidation
