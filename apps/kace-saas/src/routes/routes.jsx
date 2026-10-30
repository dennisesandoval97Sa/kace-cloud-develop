import {
    Activity,
    Archive,
    Bell,
    BookDashed,
    BookOpenCheck,
    BookType,
    BookUser,
    Boxes,
    Cable,
    CalendarCog,
    CalendarDays,
    CircleHelp,
    CloudDownload,
    FileDown,
    FileSliders,
    FileTerminal,
    FileUp,
    GitFork,
    Hash,
    Globe,
    Hourglass,
    KeySquare,
    LayoutDashboard,
    LayoutTemplate,
    ListFilter,
    Mails,
    MapPinned,
    Merge,
    Settings2,
    Shapes,
    SquareAsterisk,
    SquareFunction,
    Terminal,
    TimerReset,
    Users,
    Waypoints,
    Workflow,
    AlignHorizontalSpaceAround,
    Presentation,
    ChevronsLeftRightEllipsis,
} from "lucide-react";

import i18n from "../locale/i18n";
import { ActionIcon, ActionsIcon, ListIcon, ActionUpdateModel, DocumentIcon } from "../components/ui-shared/src/icons";
import { PlugZap } from "lucide-react";
import { TableColumnsSplit } from "lucide-react";

const { t } = i18n;
const SIZE = 20;
const SIZE_CHILDREN = 18;

export const routes = [
    {
        to: "/dashboard",
        icon: <LayoutDashboard width={SIZE} height={SIZE} />,
        name: t("navbar.dashboard"),
    },
    {
        to: "/cases",
        icon: <Archive width={SIZE} height={SIZE} />,
        name: t("navbar.cases"),
        permissions: {
            moduleId: "cases",
            permissions: ["CasesRead"],
        },
    },
    {
        icon: <Workflow width={SIZE} height={SIZE} />,
        name: t("navbar.flow"),
        permissions: {
            moduleId: ["state", "flows", "transition-rules"],
            permissions: ["StatesRead", "FlowsRead", "TransitionRulesRead"],
        },
        items: [
            {
                to: "/flujos",
                icon: <Workflow width={SIZE} height={SIZE} />,
                name: t("navbar.flow"),
                permissions: {
                    moduleId: "flows",
                    permissions: ["FlowsRead"],
                },
            },
            {
                to: "/estados",
                icon: <Waypoints width={SIZE} height={SIZE} />,
                name: t("navbar.state"),
                permissions: {
                    moduleId: "state",
                    permissions: ["StatesRead"],
                },
            },
            {
                to: "/transition-rules",
                icon: <ListFilter width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.transitionRules"),
                permissions: {
                    moduleId: "transition-rules",
                    permissions: ["TransitionRulesRead"],
                },
            },
        ],
    },
    {
        to: "/ans",
        icon: <TimerReset width={SIZE} height={SIZE} />,
        name: t("navbar.ans"),
        permissions: {
            moduleId: "ans",
            permissions: ["AnsRead"],
        },
    },
    {
        icon: <ActionsIcon width={SIZE} height={SIZE} />,
        name: t("navbar.actions"),
        permissions: {
            moduleId: ["actions", "group-list"],
            permissions: ["ActionRead", "GroupListsRead"],
        },
        items: [
            {
                to: "/actions",
                icon: <ActionIcon width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.actions"),
                permissions: {
                    moduleId: "actions",
                    permissions: ["ActionRead"],
                },
            },
            {
                to: "/update-models",
                icon: <ActionUpdateModel width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.actionUpdateModel"),
                permissions: {
                    moduleId: "actions",
                    permissions: ["ActionRead"],
                },
            },
            {
                to: "/user-list",
                icon: <BookUser width={SIZE} height={SIZE} />,
                name: t("navbar.userList"),
                permissions: {
                    moduleId: "user-lists",
                    permissions: ["UserListsRead"],
                },
            },
            {
                to: "/groupList",
                icon: <ListIcon width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.groupList"),
                permissions: {
                    moduleId: "group-list",
                    permissions: ["GroupListsRead"],
                },
            },
            {
                to: "/massive-execution",
                icon: <FileTerminal width={SIZE} height={SIZE} />,
                name: t("navbar.massiveExecution"),
                permissions: {
                    moduleId: "actions",
                    permissions: ["ActionRead"],
                },
            },
        ],
    },
    {
        to: "/boards",
        icon: <Presentation width={SIZE} height={SIZE} />,
        name: t("navbar.boards"),
        permissions: {
            moduleId: "boards",
            permissions: ["BoardsRead"],
        },
    },
    {
        to: "/clasificaciones",
        icon: <Shapes width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
        name: t("navbar.classification"),
        permissions: {
            moduleId: "classifications",
            permissions: ["ClassificationRead"],
        },
    },
    {
        to: "/folio-configurations",
        icon: <Hash width={SIZE} height={SIZE} />,
        name: t("navbar.folioConfigurations"),
        permissions: {
            moduleId: "folio-configurations",
            permissions: ["FolioConfigurationsRead"],
        },
    },
    {
        to: "/banners",
        icon: <BookType width={SIZE} height={SIZE} />,
        name: "Banners",
        permissions: {
            moduleId: "banners",
            permissions: ["BannerRead"],
        },
    },
    {
        to: "/literal",
        icon: <ListFilter width={SIZE} height={SIZE} />,
        name: t("navbar.literal"),
        permissions: {
            moduleId: "literals",
            permissions: ["LiteralsRead"],
        },
    },
    {
        to: "/templates",
        icon: <LayoutTemplate width={SIZE} height={SIZE} />,
        name: t("navbar.templates"),
        permissions: {
            moduleId: "templates",
            permissions: ["TemplatesRead"],
        },
    },
    {
        icon: <Bell width={SIZE} height={SIZE} />,
        name: t("navbar.notifications"),
        permissions: {
            moduleId: ["user-notifications", "client-notifications"],
            permissions: ["UserNotificationsRead", "ClientNotificationsRead"],
        },
        items: [
            {
                to: "/notifications-agent",
                icon: <Bell width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.notificationsAgent"),
                permissions: {
                    moduleId: "user-notifications",
                    permissions: ["UserNotificationsRead"],
                },
            },
            {
                to: "/notifications-client",
                icon: <Bell width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.notificationsClient"),
                permissions: {
                    moduleId: "client-notifications",
                    permissions: ["ClientNotificationsRead"],
                },
            },
        ],
    },
    {
        to: "/schedules",
        icon: <CalendarDays width={SIZE} height={SIZE} />,
        name: t("navbar.schedules"),
        permissions: {
            moduleId: "shift-management",
            permissions: ["ShiftManagementsRead"],
        },
    },
    {
        to: "/group",
        icon: <Boxes width={SIZE} height={SIZE} />,
        name: t("navbar.group"),
        permissions: {
            moduleId: "groups",
            permissions: ["GroupsRead"],
        },
    },
    {
        to: "/user",
        icon: <Users width={SIZE} height={SIZE} />,
        name: t("navbar.user"),
        permissions: {
            moduleId: "users",
            permissions: ["UsersRead"],
        },
    },
    {
        to: "/general-setup",
        icon: <Settings2 width={SIZE} height={SIZE} />,
        name: t("navbar.generalSetup"),
        permissions: {
            moduleId: "global-configurations",
            permissions: ["GlobalConfigurationsRead"],
        },
    },
    {
        icon: <BookOpenCheck width={SIZE} height={SIZE} />,
        name: t("navbar.agenda"),
        permissions: {
            moduleId: ["agendas", "appointment-time-slots"],
            permissions: ["AgendasRead", "AppointmentTimeSlotsRead"],
        },
        items: [
            {
                to: "/agenda",
                icon: <BookOpenCheck width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.agendaConfig"),
                permissions: {
                    moduleId: "agendas",
                    permissions: ["AgendasRead"],
                },
            },
            {
                to: "/appointment-time-slots",
                icon: <Hourglass width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.timeSlotsConfig"),
                permissions: {
                    moduleId: "appointment-time-slots",
                    permissions: ["AppointmentTimeSlotsRead"],
                },
            },
        ],
    },
    {
        to: "/roles",
        icon: <KeySquare width={SIZE} height={SIZE} />,
        name: "Roles",
        permissions: {
            moduleId: "roles",
            permissions: ["RolesRead"],
        },
    },
    {
        to: "/secrets-vaults",
        icon: <SquareAsterisk width={SIZE} height={SIZE} />,
        name: t("navbar.secretsVaults"),
        permissions: {
            moduleId: "secrets-vault",
            permissions: ["SecretsVaultsRead"],
        },
    },
    {
        to: "/mail-account",
        icon: <Mails width={SIZE} height={SIZE} />,
        name: t("navbar.mailAccounts"),
        permissions: {
            moduleId: "mail-accounts",
            permissions: ["MailAccountsRead"],
        },
    },
    {
        to: "/allowed-connections",
        icon: <Cable width={SIZE} height={SIZE} />,
        name: t("navbar.allowedConnections"),
        permissions: {
            moduleId: "allowed-connections",
            permissions: ["AllowedConnectionRead"],
        },
    },
    {
        to: "/helps",
        icon: <CircleHelp width={SIZE} height={SIZE} />,
        name: t("navbar.helps"),
        permissions: {
            moduleId: "help",
            permissions: ["HelpsRead"],
        },
    },
    {
        to: "/one-script",
        icon: <Cable width={SIZE} height={SIZE} />,
        name: t("navbar.oneScript"),
        permissions: {
            moduleId: "onescripts",
            permissions: ["OneScriptsRead"],
        },
    },
    {
        to: "/geolocation",
        icon: <MapPinned width={SIZE} height={SIZE} />,
        name: t("navbar.geolocation"),
        permissions: {
            moduleId: "geolocation",
            permissions: ["GeolocationRead"],
        },
    },
    {
        to: "/workspaces",
        icon: <AlignHorizontalSpaceAround width={SIZE} height={SIZE} />,
        name: t("navbar.workspaces"),
        permissions: {
            moduleId: "workspaces",
            permissions: ["WorkspacesRead"],
        },
    },
    {
        to: "/interactions",
        icon: <ChevronsLeftRightEllipsis width={SIZE} height={SIZE} />,
        name: t("navbar.interactions"),
        permissions: {
            moduleId: "interactions",
            permissions: ["InteractionsRead"],
        },
    },
    {
        icon: <CloudDownload width={SIZE} height={SIZE} />,
        name: t("navbar.importsExports"),
        permissions: {
            moduleId: ["imports", "exports"],
            permissions: ["Imports", "Exports"],
        },
        items: [
            {
                to: "/import-data",
                icon: <FileUp width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.imports"),
                permissions: {
                    moduleId: "imports",
                    permissions: ["Imports"],
                },
            },
            {
                to: "/export-data",
                icon: <FileDown width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.exports"),
                permissions: {
                    moduleId: "exports",
                    permissions: ["Exports"],
                },
            },
        ],
    },
    {
        to: "/generate-csv",
        icon: <DocumentIcon width={SIZE} height={SIZE} />,
        name: t("navbar.generateCsv"),
        permissions: {
            moduleId: "csv-export-views",
            permissions: ["GenerateCsvRead"],
        },
    },
    {
        icon: <Globe width={SIZE} height={SIZE} />,
        name: t("navbar.restServices"),
        permissions: {
            moduleId: ["ws-rest-endpoints", "ws-rest-functions", "ws-rest-flows"],
            permissions: ["WsRestEndpointsRead", "WsRestFunctionRead", "WsRestFlowsRead"],
        },
        items: [
            {
                to: "/rest-endpoints",
                icon: <Terminal width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.restEndpoints"),
                permissions: {
                    moduleId: "ws-rest-endpoints",
                    permissions: ["WsRestEndpointsRead"],
                },
            },
            {
                to: "/rest-functions",
                icon: <SquareFunction width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.restFunctions"),
                permissions: {
                    moduleId: "ws-rest-functions",
                    permissions: ["WsRestFunctionRead"],
                },
            },
            {
                to: "/rest-flows",
                icon: <GitFork width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.restFlow"),
                permissions: {
                    moduleId: "ws-rest-flows",
                    permissions: ["WsRestFlowsRead"],
                },
            },
        ],
    },
    {
        to: "/automation-settings",
        icon: <CalendarCog width={SIZE} height={SIZE} />,
        name: t("navbar.automationSettings"),
        permissions: {
            moduleId: "automation-settings",
            permissions: ["AutomationSettingsRead"],
        },
    },
    {
        to: "/assignment-monitor",
        icon: <Activity width={SIZE} height={SIZE} />,
        name: t("navbar.assignmentMonitor"),
        permissions: {
            moduleId: "assignment-runs",
            permissions: ["AssignmentRunsRead"],
        },
    },
    {
        icon: <Merge width={SIZE} height={SIZE} />,
        name: t("navbar.auxiliaries"),
        permissions: [
            {
                moduleId: "schemas",
                permissions: ["SchemasRead"],
            },
            {
                moduleId: "aux-definitions",
                permissions: ["AuxDefinitionsRead"],
            },
        ],
        items: [
            {
                to: "/aux/schemas",
                icon: <FileSliders width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.schemas"),
                permissions: {
                    moduleId: "schemas",
                    permissions: ["SchemasRead"],
                },
            },
            {
                to: "/aux/definitions",
                icon: <BookDashed width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.definitions"),
                permissions: {
                    moduleId: "aux-definitions",
                    permissions: ["AuxDefinitionsRead"],
                },
            },
            {
                to: "/import-auxiliaries",
                icon: <FileUp width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.imports"),
                permissions: {
                    moduleId: "imports",
                    permissions: ["Imports"],
                },
            },
            {
                to: "/export-auxiliaries",
                icon: <FileDown width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.exports"),
                permissions: {
                    moduleId: "exports",
                    permissions: ["Exports"],
                },
            },
        ],
    },
    {
        to: "/custom-lists",
        icon: <ListIcon width={SIZE} height={SIZE} />,
        name: t("navbar.listasPersonalizadas"),
        permissions: {
            moduleId: "custom-lists",
            permissions: ["CustomListsRead"],
        },
    },
    {
        to: "/reports",
        icon: <FileDown width={SIZE} height={SIZE} />,
        name: t("navbar.reportes"),
        permissions: {
            moduleId: "templates",
            permissions: ["TemplatesRead"],
        },
    },
    {
        to: "/channel-hub",
        icon: <Cable width={SIZE} height={SIZE} />,
        name: t("navbar.channel_hub"),
        permissions: {
            moduleId: ["channel-hub"],
            permissions: ["ChannelHubRead"],
        },
    },
    {
        icon: <ChevronsLeftRightEllipsis width={SIZE} height={SIZE} />,
        name: t("navbar.brokers"),
        permissions: [
            {
                moduleId: "broker_adapters",
                permissions: ["BrokerAdaptersRead"],
            },
            {
                moduleId: "broker_mappers",
                permissions: ["BrokerMappersRead"],
            },
        ],
        items: [
            {
                to: "/broker/adapters",
                icon: <PlugZap width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.broker_adapters"),
                permissions: {
                    moduleId: "broker_adapters",
                    permissions: ["BrokerAdaptersRead"],
                },
            },
            {
                to: "/broker/mappers",
                icon: <TableColumnsSplit width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
                name: t("navbar.broker_mappers"),
                permissions: {
                    moduleId: "broker_mappers",
                    permissions: ["BrokerMappersRead"],
                },
            },
        ],
    },
];
