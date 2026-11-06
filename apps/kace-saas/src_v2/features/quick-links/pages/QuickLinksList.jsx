import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useUserInformation from "@kace/hooks/useUserInformation";
import useQuickLinks from "../hooks/useQuickLinks.hook";
import QuickLinkForm from "../components/QuickLinkForm";

const hasPermission = (permissions, name) => permissions.some((entry) => entry.name === name && entry.granted === true);
const valueOf = (value) => (value && typeof value === "object" && "value" in value ? value.value : value);

export default function QuickLinksList() {
    const { t } = useTranslation();
    const { permissionsAdmin } = useUserInformation();
    const canRead = hasPermission(permissionsAdmin, "QuickLinksRead");
    const canCreate = hasPermission(permissionsAdmin, "QuickLinksCreate");
    const canDelete = hasPermission(permissionsAdmin, "QuickLinksDelete");
    const [creating, setCreating] = useState(false);
    const [actionError, setActionError] = useState("");
    const { list, create, remove } = useQuickLinks(canRead);

    const handleDelete = async (id) => {
        if (!window.confirm(t("quick_links.confirmDelete"))) return;
        setActionError("");
        try {
            await remove.mutateAsync(id);
        } catch (error) {
            setActionError(error?.response?.data?.message ?? t("quick_links.deleteError"));
        }
    };

    return (
        <DashboardSectionCard title={t("quick_links.heading")}>
            {!canRead ? (
                <p>{t("quick_links.noRead")}</p>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        {canCreate && !creating && (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="rounded bg-blue-700 px-4 py-2 text-white"
                            >
                                {t("quick_links.add")}
                            </button>
                        )}
                    </div>
                    {creating && canCreate && (
                        <QuickLinkForm
                            isPending={create.isPending}
                            onCancel={() => setCreating(false)}
                            onSubmit={async (values) => {
                                await create.mutateAsync(values);
                                setCreating(false);
                            }}
                        />
                    )}
                    {actionError && (
                        <p role="alert" className="text-red-700">
                            {actionError}
                        </p>
                    )}
                    {list.isPending && <p>{t("quick_links.loading")}</p>}
                    {list.isError && <p role="alert">{t("quick_links.listError")}</p>}
                    {list.isSuccess && (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-2">{t("quick_links.title")}</th>
                                        <th className="px-3 py-2">{t("quick_links.url")}</th>
                                        <th className="px-3 py-2">{t("quick_links.position")}</th>
                                        {canDelete && <th className="px-3 py-2">{t("quick_links.actions")}</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...list.data]
                                        .sort(
                                            (a, b) =>
                                                Number(valueOf(a.position) ?? 0) - Number(valueOf(b.position) ?? 0),
                                        )
                                        .map((item) => (
                                            <tr key={valueOf(item.id)} className="border-t border-slate-200">
                                                <td className="px-3 py-2">{valueOf(item.title)}</td>
                                                <td className="px-3 py-2">
                                                    <a
                                                        className="text-blue-700 underline"
                                                        href={valueOf(item.url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {valueOf(item.url)}
                                                    </a>
                                                </td>
                                                <td className="px-3 py-2">{valueOf(item.position)}</td>
                                                {canDelete && (
                                                    <td className="px-3 py-2">
                                                        <button
                                                            type="button"
                                                            className="text-red-700 disabled:opacity-50"
                                                            disabled={remove.isPending}
                                                            onClick={() => handleDelete(valueOf(item.id))}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    {!list.data.length && (
                                        <tr>
                                            <td className="px-3 py-4 text-center" colSpan={canDelete ? 4 : 3}>
                                                {t("quick_links.empty")}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </DashboardSectionCard>
    );
}
