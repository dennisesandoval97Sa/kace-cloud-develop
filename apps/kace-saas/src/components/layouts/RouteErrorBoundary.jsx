import { Component } from "react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "@kace/ui-shared";

const RouteErrorFallback = ({ onReload }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-background text-foreground">
            <h1 className="text-2xl font-bold mb-4">{t("text.unexpectedError")}</h1>
            <p className="text-lg mb-8">{t("text.reloadSuggestion")}</p>
            <Button onClick={onReload}>{t("text.reload")}</Button>
        </div>
    );
};

RouteErrorFallback.propTypes = {
    onReload: PropTypes.func.isRequired,
};

/**
 * Error boundary para las rutas cargadas con React.lazy.
 *
 * Captura fallos al importar un chunk (deploy parcial, caché obsoleto, red caída)
 * que de otro modo dejarian la pantalla en blanco, y ofrece recargar la pagina.
 * Es un class component porque los error boundaries no tienen equivalente con hooks.
 */
class RouteErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
        this.handleReload = this.handleReload.bind(this);
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        // No usamos console (regla del workspace). El error se refleja en el fallback;
        // el reporting a un servicio externo se podria enganchar aqui si se requiere.
        void error;
        void info;
    }

    handleReload() {
        window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            return <RouteErrorFallback onReload={this.handleReload} />;
        }

        return this.props.children;
    }
}

RouteErrorBoundary.propTypes = {
    children: PropTypes.node,
};

export default RouteErrorBoundary;
