import { trigger } from '@angular/animations';
import {
    Component,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import {
    OptionsHelperService,
    OPTIONS_HELPER_CONFIG,
} from '../../common/options-helper';
import { BridgeService } from '../../core-bridge-module/bridge.service';
import {
    Connector,
    DialogButton,
    Filetype,
    FrameEventsService,
    Node,
    NodeWrapper,
    RestConnectorsService,
    RestConstants,
    RestHelper,
    RestIamService,
    RestNodeService,
    TemporaryStorageService,
} from '../../core-module/core.module';
import { Helper } from '../../core-module/rest/helper';
import { UIAnimation } from '../../core-module/ui/ui-animation';
import { CardService } from '../../core-ui-module/card.service';
import { CardComponent } from '../../core-ui-module/components/card/card.component';
import { DropdownComponent } from '../../core-ui-module/components/dropdown/dropdown.component';
import { DateHelper } from '../../core-ui-module/DateHelper';
import { LinkData, NodeHelper } from '../../core-ui-module/node-helper';
import {
    Constrain,
    DefaultGroups,
    ElementType,
    KeyCombination,
    OptionItem,
    Scope,
    Target,
} from '../../core-ui-module/option-item';
import { Toast } from '../../core-ui-module/toast';
import { UIHelper } from '../../core-ui-module/ui-helper';
import { WorkspaceManagementDialogsComponent } from '../management-dialogs/management-dialogs.component';

@Component({
    selector: 'app-create-menu',
    templateUrl: 'create-menu.component.html',
    styleUrls: ['create-menu.component.scss'],
    animations: [
        trigger(
            'dialog',
            UIAnimation.switchDialog(UIAnimation.ANIMATION_TIME_FAST),
        ),
    ],
    providers: [
        OptionsHelperService,
        {
            provide: OPTIONS_HELPER_CONFIG,
            useValue: {
                subscribeEvents: false,
            },
        },
    ],
})
export class CreateMenuComponent implements OnDestroy {
    @ViewChild('dropdown', { static: true }) dropdown: DropdownComponent;
    @ViewChild('management') management: WorkspaceManagementDialogsComponent;

    /**
     * Currently allowed to drop files?
     */
    @Input() allowed = true;
    /**
     * Current search query
     */
    @Input() searchQuery: string;
    /**
     * Allow upload of binary files
     */
    @Input() allowBinary = true;
    /**
     * Parent location. If null, the folder picker will be shown
     */
    @Input() set parent(parent: Node) {
        this._parent = parent;
        this.showPicker = parent == null || NodeHelper.isNodeCollection(parent);
        this.updateOptions();
    }
    /**
     * can a folder be created
     */
    @Input() folder = true;

    /**
     * Fired when elements are created or uploaded
     */
    @Output() onCreate = new EventEmitter<Node[]>();

    _parent: Node = null;
    inbox: Node = null;
    addFolderName: string = null;
    showUploadSelect = false;
    filesToUpload: FileList;
    connectorList: Connector[];
    fileIsOver = false;
    showPicker: boolean;
    createConnectorName: string;
    createConnectorType: Connector;
    hasOpenWindows: boolean;
    options: OptionItem[];

    private params: Params;
    private numberModalCardsSubscription: Subscription;

    constructor(
        public bridge: BridgeService,
        private connectors: RestConnectorsService,
        private iamService: RestIamService,
        private nodeService: RestNodeService,
        private toast: Toast,
        private router: Router,
        private translate: TranslateService,
        private temporaryStorage: TemporaryStorageService,
        private route: ActivatedRoute,
        private optionsService: OptionsHelperService,
        private iam: RestIamService,
        private event: FrameEventsService,
        private cardService: CardService,
    ) {
        this.route.queryParams.subscribe(params => {
            this.params = params;
            this.updateOptions();
        });
        this.connectors.list().subscribe(() => {
            this.connectorList = this.connectors.getConnectors();
            this.updateOptions();
        });
        this.nodeService
            .getNodeMetadata(RestConstants.INBOX)
            .subscribe(node => {
                this.inbox = node.node;
            });
        this.numberModalCardsSubscription = cardService.numberModalCards.subscribe(
            n => {
                setTimeout(() => (this.hasOpenWindows = n > 0));
            },
        );
    }

    ngOnDestroy() {
        this.numberModalCardsSubscription.unsubscribe();
    }

    @HostListener('document:paste', ['$event'])
    onDataPaste(event: ClipboardEvent) {
        if (event.type === 'paste') {
            if (!this.allowed || !this.allowBinary) {
                return;
            }
            if (CardComponent.getNumberOfOpenCards() > 0) {
                return;
            }
            if (event.clipboardData.items.length > 0) {
                const item = event.clipboardData.items[0];
                if (item.type === 'text/plain') {
                    item.getAsString(data => {
                        if (data.toLowerCase().startsWith('http')) {
                            this.management.createUrlLink(new LinkData(data));
                        } else {
                            // this.toast.error(null, 'CLIPBOARD_DATA_UNSUPPORTED');
                            // it is normal text, ignore it
                            return;
                        }
                    });
                } else {
                    this.toast.error(null, 'CLIPBOARD_DATA_UNSUPPORTED');
                }
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    updateOptions() {
        this.options = [];
        if (this.allowBinary && this.folder) {
            const pasteNodes = new OptionItem(
                'OPTIONS.PASTE',
                'content_paste',
                node => this.optionsService.pasteNode(),
            );
            pasteNodes.elementType = [ElementType.Unknown];
            pasteNodes.constrains = [
                Constrain.NoSelection,
                Constrain.ClipboardContent,
                Constrain.AddObjects,
                Constrain.User,
            ];
            pasteNodes.key = 'KeyV';
            pasteNodes.keyCombination = [KeyCombination.CtrlOrAppleCmd];
            pasteNodes.group = DefaultGroups.Primary;
            this.options.push(pasteNodes);
        }
        if (this._parent && NodeHelper.isNodeCollection(this._parent)) {
            const newCollection = new OptionItem(
                'OPTIONS.NEW_COLLECTION',
                'layers',
                node =>
                    UIHelper.goToCollection(this.router, this._parent, 'new'),
            );
            newCollection.elementType = [ElementType.Unknown];
            newCollection.constrains = [Constrain.NoSelection, Constrain.User];
            newCollection.group = DefaultGroups.Create;
            newCollection.priority = 5;
            this.options.push(newCollection);
        }
        if (this.allowBinary) {
            const upload = new OptionItem(
                'WORKSPACE.ADD_OBJECT',
                'cloud_upload',
                () => (this.showUploadSelect = true),
            );
            upload.elementType = [ElementType.Unknown];
            upload.group = DefaultGroups.Create;
            upload.priority = 10;
            this.options.push(upload);
            // handle connectors
            if (this.connectorList) {
                this.options = this.options.concat(
                    this.connectorList.map((connector, i) => {
                        const option = new OptionItem(
                            'CONNECTOR.' + connector.id + '.NAME',
                            connector.icon,
                            () => this.showCreateConnector(connector),
                        );
                        option.elementType = [ElementType.Unknown];
                        option.group = DefaultGroups.CreateConnector;
                        option.priority = i;
                        return option;
                    }),
                );
            }
            // handle app
            if (this.bridge.isRunningCordova()) {
                const camera = new OptionItem(
                    'WORKSPACE.ADD_CAMERA',
                    'camera_alt',
                    () => (this.showUploadSelect = true),
                );
                camera.elementType = [ElementType.Unknown];
                camera.group = DefaultGroups.Create;
                camera.priority = 20;
                this.options.push(camera);
            }
        }
        if (this.folder) {
            const addFolder = new OptionItem(
                'WORKSPACE.ADD_FOLDER',
                'create_new_folder',
                () => (this.addFolderName = ''),
            );
            addFolder.elementType = [ElementType.Unknown];
            addFolder.group = DefaultGroups.Create;
            addFolder.priority = 30;
            this.options.push(addFolder);
        }
        this.optionsService.setData({
            scope: Scope.CreateMenu,
            parent: this._parent,
        });
        this.optionsService.setListener({
            onVirtualNodes: nodes => this.onCreate.emit(nodes),
        });
        this.options = this.optionsService.filterOptions(
            this.options,
            Target.CreateMenu,
        );
    }

    getParent() {
        return this._parent && !NodeHelper.isNodeCollection(this._parent)
            ? this._parent
            : this.inbox;
    }

    addFolder(folder: any) {
        this.addFolderName = null;
        this.toast.showProgressDialog();
        const properties = RestHelper.createNameProperty(folder.name);
        if (folder.metadataset) {
            properties[RestConstants.CM_PROP_METADATASET_EDU_METADATASET] = [
                folder.metadataset,
            ];
            properties[
                RestConstants.CM_PROP_METADATASET_EDU_FORCEMETADATASET
            ] = ['true'];
        }
        this.nodeService
            .createNode(
                this.getParent().ref.id,
                RestConstants.CM_TYPE_FOLDER,
                [],
                properties,
            )
            .subscribe(
                (data: NodeWrapper) => {
                    this.toast.closeModalDialog();
                    this.onCreate.emit([data.node]);
                    this.toast.toast('WORKSPACE.TOAST.FOLDER_ADDED');
                },
                (error: any) => {
                    this.toast.closeModalDialog();
                    if (
                        NodeHelper.handleNodeError(
                            this.bridge,
                            folder.name,
                            error,
                        ) === RestConstants.DUPLICATE_NODE_RESPONSE
                    ) {
                        this.addFolderName = folder.name;
                    }
                },
            );
    }

    uploadFiles(files: FileList) {
        this.onFileDrop(files);
    }

    onFileDrop(files: FileList) {
        if (!this.allowed) {
            /*if (this.searchQuery) {
                this.toast.error(null, 'WORKSPACE.TOAST.NOT_POSSIBLE_IN_SEARCH');
            } else {*/
            this.toast.error(null, 'WORKSPACE.TOAST.NOT_POSSIBLE_GENERAL');
            // }
            return;
        }
        if (this.filesToUpload) {
            this.toast.error(null, 'WORKSPACE.TOAST.ONGOING_UPLOAD');
            return;
        }
        this.showUploadSelect = false;
        this.filesToUpload = files;
    }

    afterUpload(nodes: Node[]) {
        if (this.params.reurl) {
            NodeHelper.addNodeToLms(
                this.router,
                this.temporaryStorage,
                nodes[0],
                this.params.reurl,
            );
        }
        this.onCreate.emit(nodes);
    }

    showCreateConnector(connector: Connector) {
        this.createConnectorName = '';
        this.createConnectorType = connector;
        this.iamService.getUser().subscribe(user => {
            if (
                user.person.quota.enabled &&
                user.person.quota.sizeCurrent >= user.person.quota.sizeQuota
            ) {
                this.toast.showModalDialog(
                    'CONNECTOR_QUOTA_REACHED_TITLE',
                    'CONNECTOR_QUOTA_REACHED_MESSAGE',
                    DialogButton.getOk(() => {
                        this.toast.closeModalDialog();
                    }),
                    true,
                );
                this.createConnectorName = null;
            }
        });
    }

    private openCamera() {
        this.bridge.getCordova().getPhotoFromCamera(
            (data: any) => {
                const name =
                    this.translate.instant('SHARE_APP.IMAGE') +
                    ' ' +
                    DateHelper.formatDate(
                        this.translate,
                        new Date().getTime(),
                        { showAlwaysTime: true, useRelativeLabels: false },
                    ) +
                    '.jpg';
                const blob: any = Helper.base64toBlob(data, 'image/jpeg');
                blob.name = name;
                const list: any = {};
                list.item = (i: number) => {
                    return blob;
                };
                list.length = 1;
                this.filesToUpload = list;
            },
            (error: any) => {
                console.warn(error);
                // this.toast.error(error);
            },
        );
    }

    private editConnector(
        node: Node = null,
        type: Filetype = null,
        win: any = null,
        connectorType: Connector = null,
    ) {
        UIHelper.openConnector(
            this.connectors,
            this.iam,
            this.event,
            this.toast,
            node,
            type,
            win,
            connectorType,
        );
    }

    private createConnector(event: any) {
        const name = event.name + '.' + event.type.filetype;
        this.createConnectorName = null;
        const prop = NodeHelper.propertiesFromConnector(event);
        let win: any;
        if (!this.bridge.isRunningCordova()) {
            win = window.open('');
        }
        this.nodeService
            .createNode(
                this._parent.ref.id,
                RestConstants.CCM_TYPE_IO,
                [],
                prop,
                false,
            )
            .subscribe(
                (data: NodeWrapper) => {
                    this.editConnector(
                        data.node,
                        event.type,
                        win,
                        this.createConnectorType,
                    );
                    this.onCreate.emit([data.node]);
                },
                (error: any) => {
                    win.close();
                    if (
                        NodeHelper.handleNodeError(
                            this.bridge,
                            event.name,
                            error,
                        ) === RestConstants.DUPLICATE_NODE_RESPONSE
                    ) {
                        this.createConnectorName = event.name;
                    }
                },
            );
    }
}
