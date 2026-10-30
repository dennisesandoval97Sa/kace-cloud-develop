import { Button } from "../ui/button"
import { LoaderThreeDots } from "../LoaderThreeDots"
import { useTranslation } from "react-i18next"
import PropTypes from "prop-types"

const Pagination = ({ table, isLoading, setNextCountItems }) => {
    const { t } = useTranslation()

    const handleNextPage = () => {
        table.nextPage()
        const total = table.getRowCount()
        const currentPage = table.options.state.pagination.pageIndex + 1
        const lessValues = total - currentPage * 10
        if (lessValues === 10) {
            setNextCountItems((prev) => prev + 100)
        }
    }

    return (
        <div className="flex items-center justify-end space-x-2">
            <Button
                type="button"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
            >
                {t("button.previous")}
            </Button>
            <Button
                type="button"
                variant="outline"
                onClick={handleNextPage}
                disabled={!table.getCanNextPage() || isLoading}
            >
                {isLoading ? <LoaderThreeDots /> : t("button.next")}
            </Button>
        </div>
    )
}

Pagination.propTypes = {
    table: PropTypes.object.isRequired,
    isLoading: PropTypes.bool.isRequired,
    setNextCountItems: PropTypes.func
}

export default Pagination
