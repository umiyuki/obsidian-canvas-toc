import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { AllCanvasNodeData } from "obsidian/canvas";

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

    async onload() {
        this.registerView(
            'canvas-explorer',
            (leaf: WorkspaceLeaf) => {
                this.view = new CanvasExplorerView(leaf, this);
                return this.view;
            }
        );

        this.addCommand({
            id: 'show-canvas-toc',
            name: 'Show Canvas Table of Contents',
            callback: () => {
                this.activateView();
            }
        });

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            if (this.view) {
                this.view.onCanvasChange();
            }
        }));
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
}

class CanvasExplorerView extends ItemView {
    plugin: CanvasExplorer;

    constructor(leaf: WorkspaceLeaf, plugin: CanvasExplorer) {
        super(leaf);
        this.plugin = plugin;
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
        const updateButton = this.containerEl.createEl('button', { text: 'Refresh' });
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

            container.createEl('h2', { text: 'Groups' });
            let groupList = container.createEl('ul');
            groups.forEach((group: AllCanvasNodeData) => {
                let listItem = groupList.createEl('li');
                listItem.createEl('a', { href: '#', text: <string>group.label });
                listItem.onClickEvent(() => focusOnNode(canvas, group));
            });

            container.createEl('h2', { text: 'Cards' });
            let cardList = container.createEl('ul');
            cards.forEach((card: AllCanvasNodeData) => {
                let listItem = cardList.createEl('li');
                listItem.createEl('a', { href: '#', text: card.type == "text" ? card.text : card.file });
                listItem.onClickEvent(() => focusOnNode(canvas, card));
            });
        } else {
            container.createEl('p', { text: 'Open a canvas to see its groups and cards.' });
        }
    }

    async onClose() {
        // Nothing to clean up
    }
}