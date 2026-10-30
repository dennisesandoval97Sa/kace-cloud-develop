import { Button } from "@kace/ui-shared"
import { useNavigate } from "react-router-dom"

const NotFound = () => {
    const navigate = useNavigate()
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-xl mb-8">
                Oops! The page you are looking for does not exist.
            </p>
            <Button onClick={() => navigate("/")}>
                Return Home
            </Button>
        </div>
    )
}

export default NotFound
