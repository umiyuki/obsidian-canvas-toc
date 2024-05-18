import { ItemView, Plugin, WorkspaceLeaf, PluginSettingTab, Setting } from "obsidian";
import { AllCanvasNodeData } from "obsidian/canvas";

interface CanvasExplorerSettings {
    showGroups: boolean;
    showCards: boolean;
    truncateNames: boolean;
}

const DEFAULT_SETTINGS: CanvasExplorerSettings = {
    showGroups: true,
    showCards: true,
    truncateNames: false
};

function focusOnNode(canvas: any, node: any) {
    canvas.zoomToBbox({
        minX: node.x - node.width * 1,
        minY: node.y - node.height * 1,
        maxX: node.x + node.width * 1,
        maxY: node.y + node.height * 1,
    });
}

export default class CanvasExplorer extends Plugin {
    view: CanvasExplorerView;
    settings: CanvasExplorerSettings;

    async onload() {
        await this.loadSettings();

        this.registerView(
            'canvas-explorer',
            (leaf: WorkspaceLeaf) => {
                this.view = new CanvasExplorerView(leaf, this);
                return this.view;
            }
        );

        this.addCommand({
            id: 'show-canvas-explorer',
            name: 'Show Canvas Explorer',
            callback: () => {
                this.activateView();
            }
        });

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            if (this.view) {
                this.view.onCanvasChange();
            }
        }));

        this.addStyle();
        this.addSettingTab(new CanvasExplorerSettingTab(this.app, this));
    }

    async activateView() {
        this.app.workspace.detachLeavesOfType('canvas-explorer');
        await this.app.workspace.getLeftLeaf(false).setViewState({
            type: 'canvas-explorer',
        });
        this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType('canvas-explorer')[0]);
    }

    getActiveCanvasView(): ItemView | null {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        if (leaves.length > 0) {
            return leaves[0].view;
        }
        return null;
    }

    addStyle() {
        const css = `
      .canvas-explorer {
        padding: 10px;
      }

      .canvas-explorer h2 {
        margin-bottom: 5px;
        font-size: var(--font-ui-small);
        font-weight: normal;
        color: var(--text-muted);
      }

      .canvas-explorer ul {
        margin-top: 0;
        margin-bottom: 20px;
        padding-left: 20px;
      }

      .canvas-explorer li {
        margin-bottom: 5px;
      }

      .canvas-explorer a {
        color: var(--text-normal);
        text-decoration: none;
      }

      .canvas-explorer a:hover {
        text-decoration: underline;
      }

      .canvas-explorer button {
        margin-bottom: 20px;
        padding: 5px 10px;
        border: none;
        border-radius: 5px;
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        cursor: pointer;
      }

      .canvas-explorer button:hover {
        background-color: var(--interactive-accent-hover);
      }
    `;
        const styleEl = document.createElement('style');
        styleEl.id = 'canvas-explorer-styles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getLocalizedString(key: string): string {
        const lang = this.app.vault.getConfig("userLanguage");
        const strings: Record<string, Record<string, string>> = {
            en: {
                "groups": "Groups",
                "cards": "Cards",
                "refresh": "Refresh",
            },
            ja: {
                "groups": "グループ",
                "cards": "カード",
                "refresh": "更新",
            },
        };
        return strings[lang]?.[key] || strings["en"][key];
    }
}

class CanvasExplorerView extends ItemView {
    plugin: CanvasExplorer;

    constructor(leaf: WorkspaceLeaf, plugin: CanvasExplorer) {
        super(leaf);
        this.plugin = plugin;
        this.containerEl.addClass('canvas-explorer');
    }

    getViewType(): string {
        return 'canvas-explorer';
    }

    getDisplayText(): string {
        return "Canvas Explorer";
    }

    async onOpen() {
        this.onCanvasChange();
        this.addUpdateButton();
    }

    addUpdateButton() {
        const updateButton = this.containerEl.createEl('button', { text: this.plugin.getLocalizedString("refresh") });
        updateButton.addEventListener('click', () => this.onCanvasChange());
    }

    async onCanvasChange() {
        const container = this.containerEl.children[1];
        container.empty();

        const canvasView = this.plugin.getActiveCanvasView();
        if (canvasView) {
            // @ts-ignore
            const canvas = canvasView.canvas;
            let groups = canvas.data.nodes.filter((a: AllCanvasNodeData) => a.type == "group");
            let cards = canvas.data.nodes.filter((a: AllCanvasNodeData) => a.type == "text" || a.type == "file");

            if (this.plugin.settings.showGroups) {
                container.createEl('h2', { text: this.plugin.getLocalizedString("groups") });
                let groupList = container.createEl('ul');

                // Sort groups by name
                groups.sort((a, b) => (<string>a.label).localeCompare(<string>b.label));

                groups.forEach((group: AllCanvasNodeData) => {
                    let listItem = groupList.createEl('li');
                    let groupName = this.plugin.settings.truncateNames ?
                        ((<string>group.label).length > 16 ? (<string>group.label).substring(0, 16) + "..." : <string>group.label) :
                        <string>group.label;
                    listItem.createEl('a', { href: '#', text: groupName });
                    listItem.onClickEvent(() => focusOnNode(canvas, group));
                });
            }

            if (this.plugin.settings.showCards) {
                container.createEl('h2', { text: this.plugin.getLocalizedString("cards") });
                let cardList = container.createEl('ul');

                // Sort cards by name
                cards.sort((a, b) => {
                    let aName = a.type == "text" ? a.text : a.file;
                    let bName = b.type == "text" ? b.text : b.file;
                    return aName.localeCompare(bName);
                });

                cards.forEach((card: AllCanvasNodeData) => {
                    let listItem = cardList.createEl('li');
                    let cardName = this.plugin.settings.truncateNames ?
                        (card.type == "text" ?
                            (card.text.length > 16 ? card.text.substring(0, 16) + "..." : card.text) :
                            (card.file.length > 16 ? card.file.substring(0, 16) + "..." : card.file)) :
                        (card.type == "text" ? card.text : card.file);
                    listItem.createEl('a', { href: '#', text: cardName });
                    listItem.onClickEvent(() => focusOnNode(canvas, card));
                });
            }
        } else {
            container.createEl('p', { text: 'Open a canvas to see its groups and cards.' });
        }
    }
}

class CanvasExplorerSettingTab extends PluginSettingTab {
    plugin: CanvasExplorer;

    constructor(app: App, plugin: CanvasExplorer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Show Groups')
            .setDesc('Show the list of groups')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showGroups)
                .onChange(async (value) => {
                    this.plugin.settings.showGroups = value;
                    await this.plugin.saveSettings();
                    this.plugin.view.onCanvasChange();
                }));

        new Setting(containerEl)
            .setName('Show Cards')
            .setDesc('Show the list of cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCards)
                .onChange(async (value) => {
                    this.plugin.settings.showCards = value;
                    await this.plugin.saveSettings();
                    this.plugin.view.onCanvasChange();
                }));

        new Setting(containerEl)
            .setName('Truncate Names')
            .setDesc('Truncate the names of groups and cards to 16 characters')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.truncateNames)
                .onChange(async (value) => {
                    this.plugin.settings.truncateNames = value;
                    await this.plugin.saveSettings();
                    this.plugin.view.onCanvasChange();
                }));
    }
}