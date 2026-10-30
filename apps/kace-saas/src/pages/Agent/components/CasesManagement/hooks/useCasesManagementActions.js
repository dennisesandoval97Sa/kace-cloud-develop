import { useNavigate } from "react-router-dom";

const useCasesManagementActions = () => {
    const navigate = useNavigate();
    const handleUpdateCase = (id) => {
        navigate(`/case/updateCase/${id}`);
    };

    return {
        handleUpdateCase,
    };
};

export default useCasesManagementActions;
