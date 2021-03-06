package org.edu_sharing.restservices.shared;


import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.util.HashMap;

import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.PreviewServlet;
import org.edu_sharing.repository.server.tools.ApplicationInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.repository.server.tools.URLTool;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.edu_sharing.service.nodeservice.NodeService;
import org.edu_sharing.service.nodeservice.NodeServiceFactory;
import org.edu_sharing.service.nodeservice.model.GetPreviewResult;
import org.edu_sharing.service.nodeservice.model.GetPreviewResult;


@ApiModel(description = "")
public class Preview  {
  
  private String url = null;
  private Integer width = null;
  private Integer height = null;
  private boolean isIcon;
  private boolean isGenerated;

  public Preview(){
	  
  }
  public Preview(NodeService nodeService,String storeProtocol,String storeIdentifier,String nodeId, String version, HashMap<String, Object> nodeProps) {
    GetPreviewResult preview = nodeService.getPreview(storeProtocol, storeIdentifier, nodeId ,nodeProps, version);
    setUrl(preview.getUrl());
    setIsIcon(preview.isIcon());

    //if(repositoryType.equals(ApplicationInfo.REPOSITORY_TYPE_ALFRESCO) || repositoryType.equals(ApplicationInfo.REPOSITORY_TYPE_LOCAL)){
    //@TODO: Elastic data will not have CM_ASSOC_THUMBNAILS (dummy property). Transfer preview detail from elastic
		  setIsIcon(!(nodeProps.containsKey(CCConstants.CCM_PROP_MAP_ICON) || nodeProps.containsKey(CCConstants.CM_ASSOC_THUMBNAILS)));
          setIsGenerated(!PreviewServlet.PreviewDetail.TYPE_USERDEFINED.equals(nodeProps.get(CCConstants.KEY_PREVIEWTYPE)));
	/*  }
	  else{
		  setUrl((String)nodeProps.get(CCConstants.CM_ASSOC_THUMBNAILS));
		  setIsIcon(false);
	  }
	  */
  }
/**
   **/
  @ApiModelProperty(required = true, value = "")
  @JsonProperty("url")
  public String getUrl() {
    return url;
  }
  public void setUrl(String url) {
    this.url = url;
  }

  
  /**
   **/
  @ApiModelProperty(required = true, value = "")
  @JsonProperty("width")
  public Integer getWidth() {
    return width;
  }
  public void setWidth(Integer width) {
    this.width = width;
  }

  
  /**
   **/
  @ApiModelProperty(required = true, value = "")
  @JsonProperty("height")
  public Integer getHeight() {
    return height;
  }
  public void setHeight(Integer height) {
    this.height = height;
  }

  

  @Override
  public String toString()  {
    StringBuilder sb = new StringBuilder();
    sb.append("class Preview {\n");
    
    sb.append("  url: ").append(url).append("\n");
    sb.append("  width: ").append(width).append("\n");
    sb.append("  height: ").append(height).append("\n");
    sb.append("}\n");
    return sb.toString();
  }
  /**
   **/
  @ApiModelProperty(required = true, value = "")
  @JsonProperty("isIcon")
  public boolean isIcon() {
    return isIcon;
  }
  public void setIsIcon(boolean isIcon) {
	this.isIcon=isIcon;
}

  @JsonProperty("isGenerated")
  public boolean isGenerated() {
    return isGenerated;
  }

  public void setIsGenerated(boolean generated) {
    isGenerated = generated;
  }
}
