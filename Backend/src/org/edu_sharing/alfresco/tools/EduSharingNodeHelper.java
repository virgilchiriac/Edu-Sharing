package org.edu_sharing.alfresco.tools;

import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.NodeService;
import org.alfresco.service.namespace.QName;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.RepoFactory;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.springframework.context.ApplicationContext;

import java.util.ArrayList;
import java.util.List;

public class EduSharingNodeHelper {
    public static ServiceRegistry serviceRegistry = (ServiceRegistry)AlfAppContextGate.getApplicationContext().getBean(ServiceRegistry.SERVICE_REGISTRY);
    
    
    private static Logger logger = Logger.getLogger(EduSharingNodeHelper.class);
    public static boolean shouldFilter(NodeRef node, List<String> filter) {
    	try {
	        NodeService nodeService = serviceRegistry.getNodeService();
	        // filter nodes for link inivitation and usages
	        if (filter == null)
	            filter = new ArrayList<>();
	
	        if (filter.contains("special")) {
	            // special mode, we do not filter anything
	            return false;
	        }
	        String type = nodeService.getType(node).toString();
	        String mapType = (String) nodeService.getProperty(node, QName.createQName(CCConstants.CCM_PROP_MAP_TYPE));
	        String name = (String) nodeService.getProperty(node, QName.createQName(CCConstants.CM_NAME));
	        if (CCConstants.CCM_TYPE_SHARE.equals(type) ||
	                CCConstants.CCM_TYPE_USAGE.equals(type) ||
	                CCConstants.CCM_TYPE_COMMENT.equals(type) ||
	                CCConstants.CCM_TYPE_COLLECTION_FEEDBACK.equals(type) ||
	                CCConstants.CM_TYPE_THUMBNAIL.equals(type)) {
	            return true;
	        }
	        // filter the metadata template file
	        if (nodeService.hasAspect(node, QName.createQName(CCConstants.CCM_ASSOC_METADATA_PRESETTING_TEMPLATE))) {
	            return true;
	        }
	        
	        if (CCConstants.CCM_VALUE_MAP_TYPE_FAVORITE.equals(mapType)) {
	            return true;
	        }
	        
	        if(CCConstants.CCM_VALUE_MAP_TYPE_EDUGROUP.equals(mapType)) {
	        	if(!filter.contains("edugroup")) {
	        		return true;
	        	}
	        }
	        //prevent later code filters only cause of filter is set
			filter.remove("edugroup");
			
			//@TODO change this in 4.2
			if(CCConstants.CCM_VALUE_MAP_TYPE_USERSAVEDSEARCH.equals(mapType)) {
	        	if(!filter.contains("savedsearch")) {
	        		return true;
	        	}
	        }
	        //prevent later code filters only cause of filter is set
			filter.remove("savedsearch");
	        
	        
	        if ((".DS_Store".equals(name) || "._.DS_Store".equals(name))) {
	            return true;
	        }
	        if(filter.size()==0)
	            return false;
	        boolean shouldFilter = true;
	        for(String f : filter) {
	            boolean isDirectory = typeIsDirectory(type);
	            if(f.equals("folders") && isDirectory){
	                shouldFilter=false;
	                break;
	            }
	            if(f.equals("files") && !isDirectory){
	                shouldFilter=false;
	                break;
	            }
	            if(f.startsWith("mime:")){
	                throw new IllegalArgumentException("Filtering by mime: is currently not supported");
	            }
	        }
	        return shouldFilter;
    	}catch(Throwable e) {
    		logger.debug(e.getMessage(), e);
    		return false;
    	}
    }
    public static boolean typeIsDirectory(String type) {
        return type.equals(CCConstants.CM_TYPE_FOLDER) || type.equals(CCConstants.CCM_TYPE_MAP);
    }
    
    public static String cleanupCmName(String cmNameReadableName){
		// replace chars that can lead to an
		// org.alfresco.repo.node.integrity.IntegrityException
		cmNameReadableName = cmNameReadableName.replaceAll(
			ApplicationInfoList.getHomeRepository().getValidatorRegexCMName(), "_");

		//replace ending dot with nothing
		//cmNameReadableName = cmNameReadableName.replaceAll("\\.$", "");
		cmNameReadableName = cmNameReadableName.replaceAll("[\\.]*$", "").trim();
		return cmNameReadableName;
	}
}