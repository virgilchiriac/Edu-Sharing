import {RestNetworkService} from '../core-module/rest/services/rest-network.service';
import {RestConnectorsService} from '../core-module/rest/services/rest-connectors.service';
import {RestConstants} from '../core-module/rest/rest-constants';
import {ListTableComponent} from '../core-ui-module/components/list-table/list-table.component';
import {ActionbarComponent} from './ui/actionbar/actionbar.component';
import {Constrain, CustomOptions, DefaultGroups, ElementType, HideMode, KeyCombination, OptionItem, Scope, Target} from '../core-ui-module/option-item';
import {UIHelper} from '../core-ui-module/ui-helper';
import {UIService} from '../core-module/rest/services/ui.service';
import {WorkspaceManagementDialogsComponent} from '../modules/management-dialogs/management-dialogs.component';
import {NodeHelper} from '../core-ui-module/node-helper';
import {Connector, Filetype, Node, NodesRightMode, NodeWrapper} from '../core-module/rest/data-object';
import {Helper} from '../core-module/rest/helper';
import {ClipboardObject, TemporaryStorageService} from '../core-module/rest/services/temporary-storage.service';
import {BridgeService} from '../core-bridge-module/bridge.service';
import {MessageType} from '../core-module/ui/message-type';
import {Inject, Injectable, InjectionToken, Optional} from '@angular/core';
import {CardComponent} from '../core-ui-module/components/card/card.component';
import {fromEvent, Observable, Subscription} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {RestNodeService} from '../core-module/rest/services/rest-node.service';
import {ConfigurationService, FrameEventsService, RestCollectionService, RestConnectorService, RestHelper, RestIamService} from '../core-module/core.module';
import {MainNavComponent} from './ui/main-nav/main-nav.component';
import {Toast} from '../core-ui-module/toast';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {DropdownComponent} from '../core-ui-module/components/dropdown/dropdown.component';


export class OptionsHelperConfig {
    subscribeEvents? = true;
}
export const OPTIONS_HELPER_CONFIG = new InjectionToken<OptionsHelperConfig>('OptionsHelperConfig');

@Injectable()
export class OptionsHelperService {
    private static subscriptionUp: Subscription;
    private static subscriptionDown: Subscription;
    private appleCmd: boolean;
    private globalOptions: OptionItem[];
    private list: ListTableComponent;
    private subscriptions: Subscription[] = [];
    private mainNav: MainNavComponent;
    private actionbar: ActionbarComponent;
    private dropdown: DropdownComponent;
    private queryParams: Params;
    private data: OptionData;
    private listener: OptionsListener;

    handleKeyboardEventUp(event: any) {
        if (event.keyCode === 91 || event.keyCode === 93) {
            this.appleCmd = false;
        }
    }
    handleKeyboardEvent(event: any) {
        if (event.keyCode === 91 || event.keyCode === 93) {
            this.appleCmd = true;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        // do nothing if a modal dialog is still open
        if (CardComponent.getNumberOfOpenCards() > 0) {
            return;
        }
        if (this.globalOptions) {
            const option = this.globalOptions.filter((o: OptionItem) => {
                if(!o.isEnabled) {
                    return false;
                }
                if (o.key !== event.code) {
                    return false;
                }
                if(o.keyCombination) {
                    if (o.keyCombination.indexOf(KeyCombination.CtrlOrAppleCmd) !== -1) {
                       if (!(event.ctrlKey || this.appleCmd)) {
                           return false;
                       }
                    }
                }
                return true;
            });
            if (option.length === 1) {
                option[0].callback(null);
                event.preventDefault();
                event.stopPropagation();
            }
        }
        }

    constructor(
        private networkService: RestNetworkService,
        private connector: RestConnectorService,
        private connectors: RestConnectorsService,
        private iamService: RestIamService,
        private router: Router,
        private route: ActivatedRoute,
        private eventService: FrameEventsService,
        private http: HttpClient,
        private ui: UIService,
        private toast: Toast,
        private translate: TranslateService,
        private nodeService: RestNodeService,
        private collectionService: RestCollectionService,
        private configService: ConfigurationService,
        private storage: TemporaryStorageService,
        private bridge: BridgeService,
        @Optional() @Inject(OPTIONS_HELPER_CONFIG) config: OptionsHelperConfig,
    ) {
        if(config == null) {
            config = new OptionsHelperConfig();
        }
        this.route.queryParams.subscribe((queryParams) => this.queryParams = queryParams);
        // @HostListener decorator unfortunately does not work in services
        if(config.subscribeEvents) {
            if (OptionsHelperService.subscriptionDown) {
                OptionsHelperService.subscriptionDown.unsubscribe();
                OptionsHelperService.subscriptionUp.unsubscribe();
            }
            OptionsHelperService.subscriptionUp = fromEvent(document, 'keyup').subscribe((event) =>
                this.handleKeyboardEventUp(event)
            );
            OptionsHelperService.subscriptionDown = fromEvent(document, 'keydown').subscribe((event) =>
                this.handleKeyboardEvent(event)
            );
        }
    }
    private cutCopyNode(node: Node, copy: boolean) {
        let list = this.getObjects(node);
        if (!list || !list.length) {
            return;
        }
        list = Helper.deepCopy(list);
        const clip: ClipboardObject = { sourceNode: this.data.parent, nodes: list, copy };
        this.storage.set('workspace_clipboard', clip);
        this.bridge.showTemporaryMessage(MessageType.info, 'WORKSPACE.TOAST.CUT_COPY', { count: list.length });
    }
    pasteNode(nodes: Node[] = []) {
        const clip = (this.storage.get('workspace_clipboard') as ClipboardObject);
        if (!this.canAddObjects()) {
            return;
        }
        if (nodes.length === clip.nodes.length) {
            this.bridge.closeModalDialog();
            this.storage.remove('workspace_clipboard');
            const info: any = {
                from: clip.sourceNode ? clip.sourceNode.name : this.translate.instant('WORKSPACE.COPY_SEARCH'),
                to: this.data.parent.name,
                count: clip.nodes.length,
                mode: this.translate.instant('WORKSPACE.' + (clip.copy ? 'PASTE_COPY' : 'PASTE_MOVE'))
            };
            this.bridge.showTemporaryMessage(MessageType.info, 'WORKSPACE.TOAST.PASTE', info);
            this.addVirtualObjects(nodes);
            return;
        }
        this.bridge.showProgressDialog();
        const target = this.data.parent.ref.id;
        const source = clip.nodes[nodes.length].ref.id;
        if (clip.copy) {
            this.nodeService.copyNode(target, source).subscribe(
                (data: NodeWrapper) => this.pasteNode(nodes.concat(data.node)),
                (error: any) => {
                    NodeHelper.handleNodeError(this.bridge, clip.nodes[nodes.length].name, error);
                    this.bridge.closeModalDialog();
                });
        }
        else {
            this.nodeService.moveNode(target, source).subscribe(
                (data: NodeWrapper) => this.pasteNode(nodes.concat(data.node)),
                (error: any) => {
                    NodeHelper.handleNodeError(this.bridge, clip.nodes[nodes.length].name, error);
                    this.bridge.closeModalDialog();
                }
            );
        }

    }
    /**
     * shortcut to simply disable all options on the given compoennts
     * @param mainNav
     * @param actionbar
     * @param list
     */
    clearComponents(mainNav: MainNavComponent,
                      actionbar: ActionbarComponent,
                      list: ListTableComponent = null) {
        if (list) {
            list.options = [];
            list.dropdownOptions = [];
        }
        if (actionbar) {
            actionbar.options = [];
        }
    }
    initComponents(mainNav: MainNavComponent,
         actionbar: ActionbarComponent = null,
         list: ListTableComponent = null,
         dropdown: DropdownComponent = null) {
        this.mainNav = mainNav;
        this.actionbar = actionbar;
        this.list = list;
        this.dropdown = dropdown;
    }
    setListener(listener: OptionsListener) {
        this.listener = listener;
    }
    /**
     * refresh all bound components with available menu options
     */
    refreshComponents() {
        if(this.subscriptions?.length){
            this.subscriptions.forEach((s) => s.unsubscribe());
            this.subscriptions = [];
        }
        if(this.mainNav) {
            this.subscriptions.push(this.mainNav.management.onRefresh.subscribe((nodes: void | Node[]) => {
                if(this.listener && this.listener.onRefresh) {
                    this.listener.onRefresh(nodes);
                }
                if(this.list) {
                    this.list.updateNodes(nodes);
                }
            }));
            this.subscriptions.push(this.mainNav.management.onDelete.subscribe(
                (result: { objects: any; count: number; error: boolean; }) => this.listener.onDelete(result)
            ));
        }

        this.globalOptions = this.getAvailableOptions(Target.Actionbar);
        if (this.list) {
            this.list.options = this.getAvailableOptions(Target.List);
            this.list.dropdownOptions = this.getAvailableOptions(Target.ListDropdown);
        }
        if(this.dropdown) {
            this.dropdown.options = this.getAvailableOptions(Target.ListDropdown);
        }
        if (this.actionbar) {
            this.actionbar.options = this.globalOptions;
        }
    }
    private isOptionEnabled(option: OptionItem, objects: Node[]|any) {
        if(option.permissionsMode === HideMode.Disable &&
            option.permissions && !this.validatePermissions(option, objects)) {
            return false;
        }
        if (option.toolpermissions != null) {
            if (!this.validateToolpermissions(option)) {
                return false;
            }
        }
        if(option.customEnabledCallback) {
            return option.customEnabledCallback(objects);
        }
        return true;
    }

    private getAvailableOptions(target: Target) {
        let objects: Node[]|any[];
        if (target === Target.List) {
            objects = this.data.allObjects && this.data.allObjects.length ? [this.data.allObjects[0]] : null;
        } else if (target === Target.Actionbar) {
            objects = this.data.selectedObjects || (this.data.activeObject ? [this.data.activeObject] : null);
        } else if (target === Target.ListDropdown) {
            if (this.data.activeObject) {
                objects = [this.data.activeObject];
            } else {
                return null;
            }
        }
        let options:OptionItem[] = [];
        if(this.mainNav) {
           options = this.prepareOptions(this.mainNav.management, objects);
        }
        options = this.applyExternalOptions(options);
        const custom = this.configService.instant('customOptions');
        NodeHelper.applyCustomNodeOptions(this.toast, this.http, this.connector, custom, this.data.allObjects, objects, options);
        // do pre-handle callback options for dropdown + actionbar
        options = this.filterOptions(options, target, objects);
        if (target !== Target.Actionbar) {
            options = options.filter((o) => !o.isToggle);
            // do not show any actions in the dropdown for no selection, these are reserved for actionbar
            options = options.filter((o) =>  !o.constrains || o.constrains.indexOf(Constrain.NoSelection) === -1);
        }
        return (UIHelper.filterValidOptions(this.ui, options) as OptionItem[]);
    }

    private handleCallbackStates(options: OptionItem[],
                                 target: Target,
                                 objects: Node[] | any[] = null) {
        this.handleCallbacks(options, objects);
        options = options.filter((o) =>
            o.showCallback(target === Target.List && objects && objects[0] ? objects[0] : null)
        );
        options.filter((o) => !o.enabledCallback(target === Target.List && objects && objects[0] ? objects[0] : null)).forEach((o) =>
            o.isEnabled = false
        );
        return options;
    }

    private isOptionAvailable(option: OptionItem, objects: Node[]|any[]) {
        if (option.elementType.indexOf(this.getType(objects)) === -1) {
            // console.log('types not matching', objects, this.getType(objects), option);
            return false;
        }
        if(option.scopes) {
            if (this.data.scope == null) {
                console.warn('Scope for options was not set, some may missing');
                return false;
            }
            if (option.scopes.indexOf(this.data.scope) === -1) {
                // console.log('scopes not matching', objects, option);
                return false;
            }
        }
        if (option.customShowCallback) {
           if (option.customShowCallback(objects) === false) {
               // console.log('customShowCallback  was false', option, objects);
               return false;
           }
        }
        if (option.permissions != null && option.permissionsMode === HideMode.Hide) {
           if (!this.validatePermissions(option, objects)) {
               // console.log('permissions missing', option, objects);
               return false;
           }
        }
        if (option.constrains != null) {
            const matched=this.objectsMatchesConstrains(option.constrains, objects);
            if(matched != null) {
                // console.log('Constrain failed: ' + matched, option, objects);
                return false;
            }
        }
        // console.log('display option', option, objects);
        return true;
    }

    private hasSelection() {
        return this.data.selectedObjects && this.data.selectedObjects.length;
    }
    private getType(objects: Node[]) : ElementType {
        if (objects) {
            const types = Array.from(new Set(objects.map((o) => this.getTypeSingle(o))));
            if(types.length === 1) {
                return types[0];
            }
        }
        return ElementType.Unknown;
    }
    private getTypeSingle(object: Node | any) {
        if(object.authorityType === RestConstants.AUTHORITY_TYPE_GROUP) {
            return ElementType.Group;
        } else if(object.authorityType === RestConstants.AUTHORITY_TYPE_USER) {
            return ElementType.Person;
        } else if (object.ref) {
            if(object.type === RestConstants.CCM_TYPE_SAVED_SEARCH) {
                return ElementType.SavedSearch;
            } else if(object.aspects.indexOf(RestConstants.CCM_ASPECT_IO_CHILDOBJECT) !== -1) {
                return ElementType.NodeChild;
            } else if(object.mediatype === 'folder-link') {
                return ElementType.MapRef;
            } else {
                if(NodeHelper.isNodePublishedCopy(object)) {
                    return ElementType.NodePublishedCopy;
                } else if (object.properties[RestConstants.CCM_PROP_IMPORT_BLOCKED]?.[0] === 'true') {
                    return ElementType.NodeBlockedImport;
                }
                return ElementType.Node;
            }
        }
        return ElementType.Unknown;
    }

    private validateToolpermissions(option: OptionItem) {
        return option.toolpermissions.filter((p) =>
            !this.connector.hasToolPermissionInstant(p)
        ).length === 0;
    }
    private validatePermissions(option: OptionItem, objects: Node[] | any[]) {
        return option.permissions.filter((p) =>
            NodeHelper.getNodesRight(objects, p, option.permissionsRightMode) === false
        ).length === 0;
    }

    private prepareOptions(management: WorkspaceManagementDialogsComponent, objects: Node[] | any[]) {
        const options: OptionItem[] = [];

        /*
        let apply=new OptionItem('APPLY', 'redo', (node: Node) => NodeHelper.addNodeToLms(this.router,this.temporaryStorageService,ActionbarHelperService.getNodes(this.selection,node)[0],this.searchService.reurl));
      apply.enabledCallback=((node:Node)=> {
        return NodeHelper.getNodesRight([node],RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original);
      });
      if(fromList || (nodes && nodes.length==1))
        options.push(apply);
      return options;
         */

        const applyNode = new OptionItem('APPLY', 'redo', (object) =>
            NodeHelper.addNodeToLms(this.router, this.storage, this.getObjects(object)[0], this.queryParams.reurl)
        );

        applyNode.permissions = [RestConstants.ACCESS_CC_PUBLISH];
        applyNode.permissionsRightMode = NodesRightMode.Original;
        applyNode.permissionsMode = HideMode.Disable;
        applyNode.constrains = [Constrain.NoBulk, Constrain.ReurlMode, Constrain.User];
        applyNode.showAsAction = true;
        applyNode.showAlways = true;
        applyNode.group = DefaultGroups.Primary;
        applyNode.priority = 10;
        applyNode.customShowCallback = ((nodes) => {
            return (this.queryParams.applyDirectories === 'true' ||
                (nodes && !nodes[0].isDirectory));
        });

        /*
       if(nodes && nodes[0].aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE)==-1) {
       option = new OptionItem("OPTIONS.INVITE", "group_add", callback);
       option.isSeperate = NodeHelper.allFiles(nodes);
       option.showAsAction = true;
       option.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CHANGE_PERMISSIONS);
     }
        */
        const debugNode = new OptionItem('OPTIONS.DEBUG', 'build', (object) =>
            management.nodeDebug = this.getObjects(object)[0],
        );
        debugNode.elementType = [ElementType.Node, ElementType.NodePublishedCopy, ElementType.NodeBlockedImport, ElementType.SavedSearch, ElementType.NodeChild, ElementType.MapRef];
        debugNode.onlyDesktop = true;
        debugNode.constrains = [Constrain.AdminOrDebug, Constrain.NoBulk];
        debugNode.group = DefaultGroups.View;
        debugNode.priority = 10;

        /*
         let openFolder = new OptionItem('SHOW_IN_FOLDER', 'folder', null);
            openFolder.isEnabled = false;
            this.nodeApi.getNodeMetadata(this._node.properties[RestConstants.CCM_PROP_IO_ORIGINAL]).subscribe((original: NodeWrapper) => {

                this.nodeApi.getNodeParents(original.node.parent.id, false, [], original.node.parent.repo).subscribe(() => {
                    openFolder.isEnabled = true;
                    openFolder.callback=() => this.goToWorkspace(login, original.node);
                    //.isEnabled = data.node.access.indexOf(RestConstants.ACCESS_WRITE) != -1;
                });
            }, (error: any) => {
            });
            options.push(openFolder);
         */

        const openParentNode = new OptionItem('OPTIONS.SHOW_IN_FOLDER', 'folder', (object) =>
            this.goToWorkspace(this.getObjects(object)[0])
        );
        openParentNode.constrains = [Constrain.Files, Constrain.NoBulk, Constrain.HomeRepository, Constrain.User];
        openParentNode.scopes = [Scope.Search, Scope.Render];
        openParentNode.customEnabledCallback = (nodes) => {
            if(nodes && nodes.length === 1) {
                openParentNode.customEnabledCallback = null;
                let nodeId = nodes[0].ref.id;
                if (nodes[0].aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE) !== -1) {
                    nodeId = nodes[0].properties[RestConstants.CCM_PROP_IO_ORIGINAL][0];
                }
                this.nodeService.getNodeParents(nodeId, false, []).subscribe(() => {
                    openParentNode.isEnabled = true;
                }, (error) => {
                    openParentNode.isEnabled = false;
                });
            }
            return false;
        };
        openParentNode.group = DefaultGroups.View;
        openParentNode.priority = 15;

        const openNode = new OptionItem('OPTIONS.SHOW', 'remove_red_eye', (object) =>
            this.list.onViewNode.emit(this.getObjects(object)[0])
        );
        openNode.constrains = [Constrain.Files, Constrain.NoBulk];
        openNode.scopes = [Scope.WorkspaceList];
        openNode.group = DefaultGroups.View;
        openNode.priority = 30;

        const editConnectorNode = new OptionItem('OPTIONS.OPEN', 'launch', (node) =>
            this.editConnector(this.getObjects(node)[0])
        );
        editConnectorNode.customShowCallback = (nodes) => {
            return this.connectors.connectorSupportsEdit(nodes ? nodes[0] : null) != null;
        }
        editConnectorNode.group = DefaultGroups.View;
        editConnectorNode.priority = 20;
        editConnectorNode.constrains = [Constrain.Files, Constrain.NoBulk];

        /**
         if (this.connector.getCurrentLogin() && !this.connector.getCurrentLogin().isGuest) {
        option = new OptionItem("OPTIONS.COLLECTION", "layers", callback);
        option.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original);
        option.showAsAction = true;
        option.customShowCallback = (node: Node) => {
            let n=ActionbarHelperService.getNodes(nodes,node);
            if(n==null)
                return false;
            return NodeHelper.referenceOriginalExists(node) && NodeHelper.allFiles(nodes) && n.length>0;
        }
        option.enabledCallback = (node: Node) => {
          let list = ActionbarHelperService.getNodes(nodes, node);
          return NodeHelper.getNodesRight(list,RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original);
        }
        option.disabledCallback = () =>{
          this.connectors.getRestConnector().getBridgeService().showTemporaryMessage(MessageType.error, null,'WORKSPACE.TOAST.ADD_TO_COLLECTION_DISABLED');
        };
      }
         */

        const addNodeToCollection = new OptionItem('OPTIONS.COLLECTION', 'layers', (object) =>
            management.addToCollection =  this.getObjects(object)
        );
        addNodeToCollection.elementType = [ElementType.Node, ElementType.NodePublishedCopy];
        addNodeToCollection.showAsAction = true;
        addNodeToCollection.constrains = [Constrain.Files, Constrain.User];
        addNodeToCollection.customShowCallback = (nodes) => {
            addNodeToCollection.name = this.data.scope === Scope.CollectionsReferences ?
                'OPTIONS.COLLECTION_OTHER' : 'OPTIONS.COLLECTION';
            return NodeHelper.referenceOriginalExists(nodes ? nodes[0] : null);
        };
        addNodeToCollection.permissions = [RestConstants.ACCESS_CC_PUBLISH];
        addNodeToCollection.permissionsRightMode = NodesRightMode.Original;
        addNodeToCollection.permissionsMode = HideMode.Disable;
        addNodeToCollection.group = DefaultGroups.Reuse;
        addNodeToCollection.priority = 10;

        const bookmarkNode=new OptionItem('OPTIONS.ADD_NODE_STORE', 'bookmark_border',(object) =>
            this.bookmarkNodes(this.getObjects(object))
        );
        bookmarkNode.elementType = [ElementType.Node, ElementType.NodePublishedCopy];
        bookmarkNode.constrains = [Constrain.Files, Constrain.HomeRepository];
        bookmarkNode.group = DefaultGroups.Reuse;
        bookmarkNode.priority = 20;

        const createNodeVariant = new OptionItem('OPTIONS.VARIANT', 'call_split', (object) =>
            management.nodeVariant =  this.getObjects(object)[0]
        );
        createNodeVariant.constrains = [Constrain.Files, Constrain.NoBulk, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.User];
        createNodeVariant.customShowCallback = (nodes) => {
            if (nodes) {
                createNodeVariant.name = 'OPTIONS.VARIANT' + (this.connectors.connectorSupportsEdit(nodes[0]) ? '_OPEN' : '');
                return NodeHelper.referenceOriginalExists(nodes[0]);
            }
            return false;
        };
        createNodeVariant.group = DefaultGroups.Reuse;
        createNodeVariant.priority = 30;

        const inviteNode = new OptionItem('OPTIONS.INVITE', 'group_add',(object) =>
            management.nodeShare = this.getObjects(object)
        );
        inviteNode.showAsAction = true;
        inviteNode.permissions = [RestConstants.ACCESS_CHANGE_PERMISSIONS];
        inviteNode.permissionsMode = HideMode.Hide;
        inviteNode.constrains = [Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.User];
        inviteNode.toolpermissions = [RestConstants.TOOLPERMISSION_INVITE];
        inviteNode.group = DefaultGroups.Edit;
        inviteNode.priority = 10;
        // invite is not allowed for collections of type editorial
        inviteNode.customShowCallback = ((objects) =>
            objects[0].collection ?
                objects[0].collection.type !== RestConstants.COLLECTIONTYPE_EDITORIAL :
                true
        );

        const licenseNode = new OptionItem('OPTIONS.LICENSE', 'copyright', (object) =>
            management.nodeLicense = this.getObjects(object)
        );
        licenseNode.elementType = [ElementType.Node, ElementType.NodeChild];
        licenseNode.constrains = [Constrain.Files, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.User];
        licenseNode.permissions = [RestConstants.ACCESS_WRITE];
        licenseNode.permissionsMode = HideMode.Disable;
        licenseNode.toolpermissions = [RestConstants.TOOLPERMISSION_LICENSE];
        licenseNode.group = DefaultGroups.Edit;
        licenseNode.priority = 30;

        const contributorNode = new OptionItem('OPTIONS.CONTRIBUTOR', 'group', (object) =>
            management.nodeContributor = this.getObjects(object)[0]
        );
        contributorNode.constrains = [Constrain.Files, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.NoBulk, Constrain.User];
        contributorNode.permissions = [RestConstants.ACCESS_WRITE];
        contributorNode.permissionsMode = HideMode.Disable;
        contributorNode.onlyDesktop = true;
        contributorNode.group = DefaultGroups.Edit;
        contributorNode.priority = 40;


        /*
        if (nodes && nodes.length==1 && !nodes[0].isDirectory  && nodes[0].type!=RestConstants.CCM_TYPE_SAVED_SEARCH && nodes[0].aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE)==-1) {
            option = new OptionItem("OPTIONS.WORKFLOW", "swap_calls", callback);
            option.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CHANGE_PERMISSIONS);
        }
         */
        const workflowNode = new OptionItem('OPTIONS.WORKFLOW', 'swap_calls', (object) =>
            management.nodeWorkflow =  this.getObjects(object)[0]
        );
        workflowNode.constrains = [Constrain.Files, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.NoBulk, Constrain.User];
        workflowNode.permissions = [RestConstants.ACCESS_CHANGE_PERMISSIONS];
        workflowNode.permissionsMode = HideMode.Disable;
        workflowNode.group = DefaultGroups.Edit;
        workflowNode.priority = 50;

        /*
        option = new OptionItem("OPTIONS.DOWNLOAD", "cloud_download", callback);
        option.enabledCallback = (node: Node) => {
          let list:any=ActionbarHelperService.getNodes(nodes, node);
          if(!list || !list.length)
            return false;
            let isAllowed=false;
            for(let item of list) {
                if(item.reference)
                    item = item.reference;
                // if at least one is allowed -> allow download (download servlet will later filter invalid files)
                isAllowed=isAllowed || list && item.downloadUrl!=null && item.properties && !item.properties[RestConstants.CCM_PROP_IO_WWWURL];
            }
            return isAllowed;
         */
        const downloadNode = new OptionItem('OPTIONS.DOWNLOAD', 'cloud_download', (object) =>
            NodeHelper.downloadNodes(this.connector, this.getObjects(object))
        );
        downloadNode.elementType = [ElementType.Node, ElementType.NodeChild, ElementType.NodePublishedCopy];
        downloadNode.constrains = [Constrain.Files];
        downloadNode.group = DefaultGroups.View;
        downloadNode.priority = 40;
        downloadNode.customEnabledCallback = (nodes) => {
            if (!nodes) {
                return false;
            }
            for (const item of nodes) {
                // if at least one is allowed -> allow download (download servlet will later filter invalid files)
                if(item.downloadUrl != null && item.properties && !item.properties[RestConstants.CCM_PROP_IO_WWWURL]) {
                    return true;
                }
            }
            return false;
        };
        const downloadMetadataNode = new OptionItem('OPTIONS.DOWNLOAD_METADATA', 'format_align_left', (object) =>
            NodeHelper.downloadNode(this.connector.getBridgeService(), this.getObjects(object)[0], RestConstants.NODE_VERSION_CURRENT, true)
        );
        downloadMetadataNode.elementType = [ElementType.Node, ElementType.NodeChild, ElementType.NodePublishedCopy];
        downloadMetadataNode.constrains = [Constrain.Files, Constrain.NoBulk];
        downloadMetadataNode.scopes = [Scope.Render];
        downloadMetadataNode.group = DefaultGroups.View;
        downloadMetadataNode.priority = 50;
        downloadMetadataNode.customShowCallback = (nodes) => {
            if (!nodes) {
                return false;
            }
            return nodes[0].downloadUrl != null;
        };
        const simpleEditNode = new OptionItem('OPTIONS.EDIT_SIMPLE', 'edu-quick_edit', (object) =>
            management.nodeSimpleEdit = this.getObjects(object)
        );
        simpleEditNode.constrains = [Constrain.Files, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.User];
        simpleEditNode.permissions = [RestConstants.ACCESS_WRITE];
        simpleEditNode.permissionsMode = HideMode.Disable;
        simpleEditNode.group = DefaultGroups.Edit;
        simpleEditNode.priority = 15;

        const editNode = new OptionItem('OPTIONS.EDIT', 'edit', (object) =>
            management.nodeMetadata = this.getObjects(object)
        );
        editNode.elementType = [ElementType.Node, ElementType.NodeChild, ElementType.MapRef];
        editNode.constrains = [Constrain.FilesAndDirectories, Constrain.NoCollectionReference, Constrain.HomeRepository, Constrain.User];
        editNode.permissions = [RestConstants.ACCESS_WRITE];
        editNode.permissionsMode = HideMode.Disable;
        editNode.group = DefaultGroups.Edit;
        editNode.priority = 20;


        const editNodeOriginal = new OptionItem('OPTIONS.EDIT_ORIGINAL', 'edit', (object) => {
            this.nodeService.getNodeMetadata(this.getObjects(object)[0].properties[RestConstants.CCM_PROP_IO_ORIGINAL][0]).subscribe((node) => {
                management.nodeMetadata = [node.node];
            });
        });
        editNodeOriginal.constrains = [Constrain.CollectionReference, Constrain.HomeRepository, Constrain.User];
        editNodeOriginal.permissions = [RestConstants.ACCESS_WRITE];
        editNodeOriginal.permissionsRightMode = NodesRightMode.Original;
        editNodeOriginal.permissionsMode = HideMode.Disable;
        editNodeOriginal.group = DefaultGroups.Edit;
        editNodeOriginal.priority = 20;


        const templateNode = new OptionItem('OPTIONS.TEMPLATE', 'assignment_turned_in', (object) =>
            management.nodeTemplate = this.getObjects(object)[0]
        );
        templateNode.constrains = [Constrain.NoBulk, Constrain.Directory, Constrain.User];
        templateNode.permissions = [RestConstants.ACCESS_WRITE];
        templateNode.permissionsMode = HideMode.Disable;
        templateNode.onlyDesktop = true;
        templateNode.group = DefaultGroups.Edit;


        const linkMap = new OptionItem('OPTIONS.LINK_MAP', 'link', (node) =>
            management.linkMap = this.getObjects(node)[0]
        );
        linkMap.constrains = [Constrain.NoBulk, Constrain.HomeRepository, Constrain.User, Constrain.Directory];
        linkMap.toolpermissions = [RestConstants.TOOLPERMISSION_CREATE_MAP_LINK];
        linkMap.scopes = [Scope.WorkspaceList, Scope.WorkspaceTree];
        linkMap.permissionsMode = HideMode.Hide;
        linkMap.group = DefaultGroups.FileOperations;
        linkMap.priority = 5;

        /**
         const cut = new OptionItem('OPTIONS.CUT', 'content_cut', (node: Node) => this.cutCopyNode(node, false));
         cut.isSeperate = true;
         cut.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE)
         && (this.root === 'MY_FILES' || this.root === 'SHARED_FILES');
         options.push(cut);
         options.push(new OptionItem('OPTIONS.COPY', 'content_copy', (node: Node) => this.cutCopyNode(node, true)));
         */
        const cutNodes = new OptionItem('OPTIONS.CUT', 'content_cut', (node) =>
            this.cutCopyNode(node, false)
        );
        cutNodes.elementType = [ElementType.Node, ElementType.SavedSearch, ElementType.MapRef]
        cutNodes.constrains = [Constrain.HomeRepository, Constrain.User];
        cutNodes.scopes = [Scope.WorkspaceList, Scope.WorkspaceTree];
        cutNodes.permissions = [RestConstants.ACCESS_WRITE];
        cutNodes.permissionsMode = HideMode.Disable;
        cutNodes.key = 'KeyX';
        cutNodes.keyCombination = [KeyCombination.CtrlOrAppleCmd];
        cutNodes.group = DefaultGroups.FileOperations;
        cutNodes.priority = 10;

        const copyNodes = new OptionItem('OPTIONS.COPY', 'content_copy', (node) =>
            this.cutCopyNode(node, true)
        );
        // do not allow copy of map links if tp is missing
        copyNodes.customEnabledCallback = ((node) =>
            node?.some((n) => this.getTypeSingle(n) === ElementType.MapRef) ?
                this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_CREATE_MAP_LINK) : true
        );

        copyNodes.elementType = [ElementType.Node, ElementType.SavedSearch, ElementType.MapRef]
        copyNodes.constrains = [Constrain.HomeRepository, Constrain.User];
        copyNodes.scopes = [Scope.WorkspaceList, Scope.WorkspaceTree];
        copyNodes.key = 'KeyC';
        copyNodes.keyCombination = [KeyCombination.CtrlOrAppleCmd];
        copyNodes.group = DefaultGroups.FileOperations;
        copyNodes.priority = 20;

        const pasteNodes = new OptionItem('OPTIONS.PASTE', 'content_paste', (node) =>
            this.pasteNode()
        );
        pasteNodes.elementType = [ElementType.Unknown];
        pasteNodes.constrains = [Constrain.NoSelection, Constrain.ClipboardContent, Constrain.AddObjects, Constrain.User];
        pasteNodes.toolpermissions = [RestConstants.TOOLPERMISSION_CREATE_ELEMENTS_FOLDERS, RestConstants.TOOLPERMISSION_CREATE_ELEMENTS_FILES];
        pasteNodes.scopes = [Scope.WorkspaceList];
        pasteNodes.key = 'KeyV';
        pasteNodes.keyCombination = [KeyCombination.CtrlOrAppleCmd];
        pasteNodes.group = DefaultGroups.FileOperations;

        const deleteNode = new OptionItem('OPTIONS.DELETE', 'delete',(object) => {
            management.nodeDelete = this.getObjects(object);
        });
        deleteNode.elementType = [ElementType.Node, ElementType.SavedSearch, ElementType.MapRef];
        deleteNode.constrains = [Constrain.HomeRepository, Constrain.NoCollectionReference, Constrain.User];
        deleteNode.permissions = [RestConstants.PERMISSION_DELETE];
        deleteNode.permissionsMode = HideMode.Hide;
        deleteNode.key = 'Delete';
        deleteNode.group = DefaultGroups.Delete;
        deleteNode.priority = 10;

        const unblockNode = new OptionItem('OPTIONS.UNBLOCK_IMPORT', 'sync',(object) => {
            management.nodeImportUnblock = this.getObjects(object);
        });
        unblockNode.elementType = [ElementType.NodeBlockedImport];
        unblockNode.constrains = [Constrain.HomeRepository, Constrain.NoCollectionReference, Constrain.User];
        unblockNode.permissions = [RestConstants.PERMISSION_DELETE];
        unblockNode.permissionsMode = HideMode.Hide;
        unblockNode.group = DefaultGroups.Edit;
        unblockNode.priority = 10;


        const unpublishNode = new OptionItem('OPTIONS.UNPUBLISH', 'cloud_off',(object) => {
            management.nodeDelete = this.getObjects(object);
        });
        unpublishNode.elementType = [ElementType.NodePublishedCopy];
        unpublishNode.constrains = [Constrain.HomeRepository, Constrain.User];
        unpublishNode.permissions = [RestConstants.PERMISSION_DELETE];
        unpublishNode.permissionsMode = HideMode.Hide;
        unpublishNode.group = DefaultGroups.Delete;
        unpublishNode.priority = 10;


        const removeNodeRef =  new OptionItem('OPTIONS.REMOVE_REF','remove_circle_outline', (object) =>
            this.removeFromCollection(this.getObjects(object))
        );
        removeNodeRef.constrains = [Constrain.HomeRepository, Constrain.CollectionReference, Constrain.User];
        removeNodeRef.permissions = [RestConstants.PERMISSION_DELETE];
        removeNodeRef.permissionsMode = HideMode.Disable;
        removeNodeRef.scopes = [Scope.CollectionsReferences, Scope.Render];
        removeNodeRef.group = DefaultGroups.Delete;
        removeNodeRef.priority = 20;

        /*
        let report = new OptionItem('NODE_REPORT.OPTION', 'flag', (node: Node) => this.nodeReport=this.getCurrentNode(node));
        report.customShowCallback=(node:Node)=>{
            let n=ActionbarHelperService.getNodes(nodes,node);
            if(n==null)
                return false;
          return RestNetworkService.allFromHomeRepo(n,this.allRepositories);
        }
        options.push(report);
         */
        const reportNode = new OptionItem('OPTIONS.NODE_REPORT', 'flag', (node) =>
            management.nodeReport = this.getObjects(node)[0]
        );
        reportNode.constrains = [Constrain.Files, Constrain.NoBulk, Constrain.HomeRepository];
        reportNode.scopes = [Scope.Search, Scope.CollectionsReferences, Scope.Render];
        reportNode.customShowCallback = (() => this.configService.instant('nodeReport', false));
        reportNode.group = DefaultGroups.View;
        reportNode.priority = 60;

        const qrCodeNode = new OptionItem('OPTIONS.QR_CODE', 'edu-qr_code', (node) =>
            management.qr = {
                node: this.getObjects(node)[0],
                data: window.location.href
            }
        );
        qrCodeNode.constrains = [Constrain.Files, Constrain.NoBulk];
        qrCodeNode.scopes = [Scope.Render];
        qrCodeNode.group = DefaultGroups.View;
        qrCodeNode.priority = 70;

        /**
         * if (this.isAllowedToEditCollection()) {
            this.optionsCollection.push(
                new OptionItem('COLLECTIONS.ACTIONBAR.EDIT', 'edit', () =>
                    this.collectionEdit(),
                ),
            );
        }*/
        const editCollection = new OptionItem('OPTIONS.COLLECTION_EDIT', 'edit', (object) =>
            this.editCollection(this.getObjects(object)[0])
        );
        editCollection.constrains = [Constrain.HomeRepository, Constrain.Collections, Constrain.NoBulk, Constrain.User];
        editCollection.permissions = [RestConstants.ACCESS_WRITE];
        editCollection.permissionsMode = HideMode.Hide;
        editCollection.showAsAction = true;
        editCollection.group = DefaultGroups.Edit;
        editCollection.priority = 5;

        /*
         if (this.pinningAllowed && this.isAllowedToDeleteCollection()) {
            this.optionsCollection.push(
                new OptionItem('COLLECTIONS.ACTIONBAR.PIN', 'edu-pin', () =>
                    this.pinCollection(),
                ),
            );
        }
        */
        const pinCollection = new OptionItem('OPTIONS.COLLECTION_PIN', 'edu-pin', (object) =>
            management.addPinnedCollection = this.getObjects(object)[0]
        );
        pinCollection.constrains = [Constrain.HomeRepository, Constrain.Collections, Constrain.NoBulk, Constrain.User];
        pinCollection.permissions = [RestConstants.ACCESS_WRITE];
        pinCollection.permissionsMode = HideMode.Hide;
        pinCollection.toolpermissions = [RestConstants.TOOLPERMISSION_COLLECTION_PINNING];
        pinCollection.group = DefaultGroups.Edit;
        pinCollection.priority = 20;

        const feedbackCollection = new OptionItem('OPTIONS.COLLECTION_FEEDBACK', 'chat_bubble', (object) =>
            management.collectionWriteFeedback = this.getObjects(object)[0]
        );
        feedbackCollection.constrains = [Constrain.HomeRepository, Constrain.Collections, Constrain.NoBulk, Constrain.User];
        feedbackCollection.permissions = [RestConstants.PERMISSION_FEEDBACK];
        feedbackCollection.permissionsMode = HideMode.Hide;
        feedbackCollection.toolpermissions = [RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK];
        feedbackCollection.group = DefaultGroups.View;
        feedbackCollection.priority = 10;
        // feedback is only shown for non-managers
        feedbackCollection.customShowCallback = ((objects) =>
            objects && objects[0].access && objects[0].access.indexOf(RestConstants.ACCESS_WRITE) === -1
        );
        /*
         if (
         this.feedbackAllowed() &&
         !this.isAllowedToDeleteCollection() &&
         this.connector.hasToolPermissionInstant(
         RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK,
         )
         ) {
            this.optionsCollection.push(
                new OptionItem(
                    'COLLECTIONS.ACTIONBAR.FEEDBACK',
                    'chat_bubble',
                    () => this.collectionFeedback(true),
                ),
            );
        }
         */
        const feedbackCollectionView = new OptionItem('OPTIONS.COLLECTION_FEEDBACK_VIEW', 'speaker_notes', (object) =>
            management.collectionViewFeedback = this.getObjects(object)[0]
        );
        feedbackCollectionView.constrains = [Constrain.HomeRepository, Constrain.Collections, Constrain.NoBulk, Constrain.User];
        feedbackCollectionView.permissions = [RestConstants.ACCESS_DELETE];
        feedbackCollectionView.permissionsMode = HideMode.Hide;
        feedbackCollectionView.toolpermissions = [RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK];
        feedbackCollectionView.group = DefaultGroups.View;
        feedbackCollectionView.priority = 20;

        /*
        const options = [];
        this.viewToggle = new OptionItem('OPTIONS.TOGGLE_VIEWTYPE', this.viewType === 0 ? 'view_module' : 'list', (node: Node) => this.toggleView());
        this.viewToggle.isToggle = true;
        options.push(this.viewToggle);
         */
        // tslint:disable-next-line:triple-equals
        const toggleViewType = new OptionItem('OPTIONS.TOGGLE_VIEWTYPE', this.list ? this.list.viewType == 0 ? 'view_module' : 'list' : '', (object) => {
            // tslint:disable-next-line:triple-equals
            this.list.setViewType(this.list.viewType == 1 ? 0 : 1);
            // tslint:disable-next-line:triple-equals
            toggleViewType.icon = this.list ? this.list.viewType == 0 ? 'view_module' : 'list' : '';
        });
        toggleViewType.scopes = [Scope.WorkspaceList, Scope.Search, Scope.CollectionsReferences];
        toggleViewType.constrains = [Constrain.NoSelection];
        toggleViewType.group = DefaultGroups.Toggles;
        toggleViewType.elementType = [ElementType.Unknown];
        toggleViewType.priority = 10;
        toggleViewType.isToggle = true;
        /*
        const reorder = new OptionItem('OPTIONS.LIST_SETTINGS', 'settings', (node: Node) => this.reorderDialog = true);
        reorder.isToggle = true;
        options.push(reorder);
        return options;
         */
        const configureList = new OptionItem('OPTIONS.LIST_SETTINGS', 'settings', (node: Node) =>
            this.list.showReorder()
        );
        configureList.scopes = [Scope.WorkspaceList];
        configureList.constrains = [Constrain.NoSelection, Constrain.User];
        configureList.group = DefaultGroups.Toggles;
        configureList.elementType = [ElementType.Unknown];
        configureList.priority = 20;
        configureList.isToggle = true;
        /*

            this.infoToggle = new OptionItem('WORKSPACE.OPTION.METADATA', 'info_outline', (node: Node) => this.openMetadata(node));
            this.infoToggle.isToggle = true;
            options.push(this.infoToggle);
         */
        const metadataSidebar = new OptionItem('OPTIONS.METADATA_SIDEBAR', 'info_outline', (object) => {
            management.nodeSidebarChange.subscribe((change: Node) => {
                metadataSidebar.icon = change ? 'info' : 'info_outline'
            });
            management.nodeSidebar = management.nodeSidebar ? null : this.getObjects(object)[0]
            management.nodeSidebarChange.emit(management.nodeSidebar);

        });
        metadataSidebar.scopes = [Scope.WorkspaceList];
        metadataSidebar.constrains = [Constrain.NoBulk];
        metadataSidebar.group = DefaultGroups.Toggles;
        metadataSidebar.isToggle = true;

        options.push(applyNode);
        options.push(debugNode);
        options.push(openParentNode);
        options.push(openNode);
        options.push(editConnectorNode);
        options.push(bookmarkNode);
        options.push(editCollection);
        options.push(pinCollection);
        options.push(feedbackCollection);
        options.push(feedbackCollectionView);
        options.push(simpleEditNode);
        options.push(editNode);
        options.push(editNodeOriginal);
        // add to collection
        options.push(addNodeToCollection);
        // create variant
        options.push(createNodeVariant);
        options.push(templateNode);
        options.push(inviteNode);
        options.push(licenseNode);
        options.push(contributorNode);
        options.push(workflowNode);
        options.push(downloadNode);
        options.push(downloadMetadataNode);
        options.push(qrCodeNode);
        options.push(linkMap);
        options.push(cutNodes);
        options.push(copyNodes);
        options.push(pasteNodes);
        options.push(deleteNode);
        options.push(unpublishNode);
        options.push(unblockNode);
        options.push(removeNodeRef);
        options.push(reportNode);
        options.push(toggleViewType);
        options.push(configureList);
        options.push(metadataSidebar);

        return options;
    }

    private editConnector(node: Node|any, type: Filetype = null, win: any = null, connectorType: Connector = null) {
        UIHelper.openConnector(this.connectors, this.iamService, this.eventService, this.toast, node, type, win, connectorType);
    }
    private canAddObjects() {
        return this.data.parent && NodeHelper.getNodesRight([this.data.parent], RestConstants.ACCESS_ADD_CHILDREN);
    }

    private addVirtualObjects(objects: any[]) {
        objects = objects.map((o: any) => {
            o.virtual = true;
            return o;
        });
        if(this.listener && this.listener.onVirtualNodes) {
            this.listener.onVirtualNodes(objects);
        }
        if(this.list) {
            this.list.addVirtualNodes(objects);
        }
    }

    private bookmarkNodes(nodes: Node[]) {
        this.bridge.showProgressDialog();
        RestHelper.addToStore(nodes,this.bridge,this.iamService,()=> {
            this.bridge.closeModalDialog();
            this.mainNav.refreshNodeStore();
        });
    }

    /**
     * overwrite all the show callbacks by using the internal constrains + permission handlers
     * isOptionAvailable will check if customShowCallback exists and will also call it
     */
    private handleCallbacks(options: OptionItem[], objects: Node[]|any) {
        options.forEach((o) => {
            o.showCallback = ((object) => {
                const list = NodeHelper.getActionbarNodes(objects, object);
                return this.isOptionAvailable(o, list);
            });
            o.enabledCallback = ((object) => {
                const list = NodeHelper.getActionbarNodes(objects, object);
                return this.isOptionEnabled(o, list);
            });
        });
    }

    private goToWorkspace(node: Node | any) {
        if(node.aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE) !== -1){
            this.nodeService.getNodeMetadata(node.properties[RestConstants.CCM_PROP_IO_ORIGINAL][0]).subscribe((org) =>
                UIHelper.goToWorkspace(this.nodeService, this.router, this.connector.getCurrentLogin(), org.node)
            );
        } else {
            UIHelper.goToWorkspace(this.nodeService, this.router, this.connector.getCurrentLogin(), node);
        }
    }

    private getObjects(object: Node | any) {
        return NodeHelper.getActionbarNodes(this.data.selectedObjects || [this.data.activeObject], object);
    }

    applyExternalOptions(options: OptionItem[]) {
        if (!this.data.customOptions) {
            return options;
        }
        if (!this.data.customOptions.useDefaultOptions) {
            options = [];
        }
        if (this.data.customOptions.addOptions) {
            for (const option of this.data.customOptions.addOptions) {
                const existing = options.filter((o) => o.name === option.name);
                if (existing.length === 1) {
                    // only replace changed values
                    for (const key of Object.keys(option)) {
                        (existing[0] as any)[key] = (option as any)[key];
                    }
                } else {
                    options.push(option);
                }
            }
        }
        if (this.data.customOptions.supportedOptions && this.data.customOptions.supportedOptions.length > 0) {
            options = options.filter((o) => this.data.customOptions.supportedOptions.indexOf(o.name) !== -1);
        }else if (this.data.customOptions.removeOptions) {
            for (const option of this.data.customOptions.removeOptions) {
                const index = options.findIndex((o) => o.name === option);
                if (index !== -1) {
                    options.splice(index, 1);
                }
            }
        }
        return options;
    }
    setData(data: OptionData) {
        this.data = data;
    }
    private sortOptionsByGroup(options: OptionItem[]) {
        if(!options) {
            return null;
        }
        let result: OptionItem[] = [];
        let groups=Array.from(new Set(options.map((o) => o.group)));
        groups = groups.sort((o1, o2) => o1.priority > o2.priority ? 1 : -1);
        for (const group of groups) {
            const groupOptions = options.filter((o) => o.group === group);
            if (group == null) {
                console.warn('There are options not assigned to a group. All options should be assigned to a group', groupOptions);
            }
            groupOptions.sort((o1, o2) => o1.priority > o2.priority ? 1 : -1);
            result = result.concat(groupOptions);
        }
        return result;
    }

    private objectsMatchesConstrains(constrains: Constrain[], objects: Node[]|any[]) {
        if (constrains.indexOf(Constrain.NoCollectionReference) !== -1) {
            if (objects.some((o) => o.aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE) !== -1)) {
                return Constrain.NoCollectionReference;
            }
        }
        if (constrains.indexOf(Constrain.CollectionReference) !== -1) {
            if (objects.some((o) => o.aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE) === -1)) {
                return Constrain.CollectionReference;
            }
        }
        if (constrains.indexOf(Constrain.NoBulk) !== -1) {
            if (objects.length > 1) {
                return Constrain.NoBulk;
            }
        }
        if (constrains.indexOf(Constrain.Directory) !== -1) {
            if (objects.some((o) => !o.isDirectory || o.collection)) {
                return Constrain.Directory;
            }
        }
        if (constrains.indexOf(Constrain.Collections) !== -1) {
            if (objects.some((o) => !o.isDirectory || !o.collection)) {
                return Constrain.Collections;
            }
        }
        if (constrains.indexOf(Constrain.Files) !== -1) {
            if (objects.some((o) => o.isDirectory || o.type !== RestConstants.CCM_TYPE_IO)) {
                return Constrain.Files;
            }
        }
        if (constrains.indexOf(Constrain.FilesAndDirectories) !== -1) {
            if (objects.some((o) => o.collection || o.type !== RestConstants.CCM_TYPE_IO && o.type !== RestConstants.CCM_TYPE_MAP)) {
                return Constrain.FilesAndDirectories;
            }
        }
        if (constrains.indexOf(Constrain.Admin) !== -1) {
            if (!this.connectors.getRestConnector().getCurrentLogin().isAdmin) {
                return Constrain.Admin;
            }
        }
        if (constrains.indexOf(Constrain.AdminOrDebug) !== -1) {
            if (!this.connectors.getRestConnector().getCurrentLogin().isAdmin &&
                !(window as any).esDebug) {
                return Constrain.AdminOrDebug;
            }
        }
        if (constrains.indexOf(Constrain.User) !== -1) {
            if (this.connectors.getRestConnector().getCurrentLogin() &&
                this.connectors.getRestConnector().getCurrentLogin().statusCode !== RestConstants.STATUS_CODE_OK) {
                return Constrain.User;
            }
        }
        if (constrains.indexOf(Constrain.NoSelection) !== -1) {
            if (objects && objects.length) {
                return Constrain.NoSelection;
            }
        }
        if (constrains.indexOf(Constrain.ClipboardContent) !== -1) {
            if (this.storage.get('workspace_clipboard') == null) {
                return Constrain.ClipboardContent;
            }
        }
        if (constrains.indexOf(Constrain.AddObjects) !== -1) {
            if (!this.canAddObjects()) {
                return Constrain.AddObjects;
            }
        }
        if (constrains.indexOf(Constrain.HomeRepository) !== -1) {
            if(!RestNetworkService.allFromHomeRepo(objects)) {
                return Constrain.HomeRepository;
            }
        }
        if (constrains.indexOf(Constrain.ReurlMode) !== -1) {
            if(!this.queryParams.reurl) {
                return Constrain.ReurlMode;
            }
        }
        return null;
    }

    private removeFromCollection(objects: Node[] | any) {
        Observable.forkJoin(objects.map((o: Node|any) =>
            this.collectionService.removeFromCollection(o.ref.id, this.data.parent.ref.id)
        )).subscribe(() =>
            this.listener.onDelete({objects, error: false, count: objects.length})
        , (error) =>
            this.listener.onDelete({objects, error: true, count: objects.length})
        );
    }

    private editCollection(object: Node|any) {
        UIHelper.goToCollection(this.router, object, 'edit');
    }

    /**
     * Filter options, can be also used externally
     * @param options
     * @param target
     * @param objects
     */
    public filterOptions(options: OptionItem[], target: Target, objects: Node[]|any = null) {
        options = this.handleCallbackStates(options, target, objects);
        options = this.sortOptionsByGroup(options);
        return options;
    }
}
export interface OptionsListener {
    onVirtualNodes?: (nodes: Node[]) => void;
    onRefresh?: (nodes: Node[]|void) => void;
    onDelete?: (result: { objects: Node[] | any; count: number; error: boolean }) => void;
}
export interface OptionData {
    scope: Scope;
    activeObject?: Node|any;
    selectedObjects?: Node[] | any[];
    allObjects?: Node[] | any[];
    parent?: Node|any;
    customOptions?: CustomOptions;
}

