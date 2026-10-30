import SchemasFieldActions from "../components/SchemasFieldActions"

export const getDynamicFieldsColumns = ({ handleEdit, remove, t }) => {
    return [
        {
            id: "actions",
            cell: ({ row }) => (
                <SchemasFieldActions handleEdit={handleEdit} handleRemove={remove} row={row} />
            )
        },
        {
            accessorKey: "name",
            header: t("auxSchema.form.fieldName"),
            cell: ({ row }) => <div className="font-medium">{row.original.name || "-"}</div>
        },
        {
            accessorKey: "type",
            header: t("auxSchema.form.dataType"),
            cell: ({ row }) => <div className="capitalize">{row.original.type}</div>
        },
        {
            accessorKey: "required",
            header: t("auxSchema.form.required"),
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    row.original.required
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                }`}>
                    {row.original.required ? t("app.yes", "Yes") : t("app.no", "No")}
                </span>
            )
        }
    ]
}
