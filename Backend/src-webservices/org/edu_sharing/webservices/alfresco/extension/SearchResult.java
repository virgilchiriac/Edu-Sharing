/**
 * SearchResult.java
 *
 * This file was auto-generated from WSDL
 * by the Apache Axis 1.4 Apr 22, 2006 (06:55:48 PDT) WSDL2Java emitter.
 */

package org.edu_sharing.webservices.alfresco.extension;

public class SearchResult  implements java.io.Serializable {
    private org.edu_sharing.webservices.alfresco.extension.RepositoryNode[] data;

    private org.edu_sharing.webservices.alfresco.extension.Facette[] facettes;

    private int nodeCount;

    private int startIDX;

    public SearchResult() {
    }

    public SearchResult(
           org.edu_sharing.webservices.alfresco.extension.RepositoryNode[] data,
           org.edu_sharing.webservices.alfresco.extension.Facette[] facettes,
           int nodeCount,
           int startIDX) {
           this.data = data;
           this.facettes = facettes;
           this.nodeCount = nodeCount;
           this.startIDX = startIDX;
    }


    /**
     * Gets the data value for this SearchResult.
     * 
     * @return data
     */
    public org.edu_sharing.webservices.alfresco.extension.RepositoryNode[] getData() {
        return data;
    }


    /**
     * Sets the data value for this SearchResult.
     * 
     * @param data
     */
    public void setData(org.edu_sharing.webservices.alfresco.extension.RepositoryNode[] data) {
        this.data = data;
    }


    /**
     * Gets the facettes value for this SearchResult.
     * 
     * @return facettes
     */
    public org.edu_sharing.webservices.alfresco.extension.Facette[] getFacettes() {
        return facettes;
    }


    /**
     * Sets the facettes value for this SearchResult.
     * 
     * @param facettes
     */
    public void setFacettes(org.edu_sharing.webservices.alfresco.extension.Facette[] facettes) {
        this.facettes = facettes;
    }


    /**
     * Gets the nodeCount value for this SearchResult.
     * 
     * @return nodeCount
     */
    public int getNodeCount() {
        return nodeCount;
    }


    /**
     * Sets the nodeCount value for this SearchResult.
     * 
     * @param nodeCount
     */
    public void setNodeCount(int nodeCount) {
        this.nodeCount = nodeCount;
    }


    /**
     * Gets the startIDX value for this SearchResult.
     * 
     * @return startIDX
     */
    public int getStartIDX() {
        return startIDX;
    }


    /**
     * Sets the startIDX value for this SearchResult.
     * 
     * @param startIDX
     */
    public void setStartIDX(int startIDX) {
        this.startIDX = startIDX;
    }

    private java.lang.Object __equalsCalc = null;
    public synchronized boolean equals(java.lang.Object obj) {
        if (!(obj instanceof SearchResult)) return false;
        SearchResult other = (SearchResult) obj;
        if (obj == null) return false;
        if (this == obj) return true;
        if (__equalsCalc != null) {
            return (__equalsCalc == obj);
        }
        __equalsCalc = obj;
        boolean _equals;
        _equals = true && 
            ((this.data==null && other.getData()==null) || 
             (this.data!=null &&
              java.util.Arrays.equals(this.data, other.getData()))) &&
            ((this.facettes==null && other.getFacettes()==null) || 
             (this.facettes!=null &&
              java.util.Arrays.equals(this.facettes, other.getFacettes()))) &&
            this.nodeCount == other.getNodeCount() &&
            this.startIDX == other.getStartIDX();
        __equalsCalc = null;
        return _equals;
    }

    private boolean __hashCodeCalc = false;
    public synchronized int hashCode() {
        if (__hashCodeCalc) {
            return 0;
        }
        __hashCodeCalc = true;
        int _hashCode = 1;
        if (getData() != null) {
            for (int i=0;
                 i<java.lang.reflect.Array.getLength(getData());
                 i++) {
                java.lang.Object obj = java.lang.reflect.Array.get(getData(), i);
                if (obj != null &&
                    !obj.getClass().isArray()) {
                    _hashCode += obj.hashCode();
                }
            }
        }
        if (getFacettes() != null) {
            for (int i=0;
                 i<java.lang.reflect.Array.getLength(getFacettes());
                 i++) {
                java.lang.Object obj = java.lang.reflect.Array.get(getFacettes(), i);
                if (obj != null &&
                    !obj.getClass().isArray()) {
                    _hashCode += obj.hashCode();
                }
            }
        }
        _hashCode += getNodeCount();
        _hashCode += getStartIDX();
        __hashCodeCalc = false;
        return _hashCode;
    }

    // Type metadata
    private static org.apache.axis.description.TypeDesc typeDesc =
        new org.apache.axis.description.TypeDesc(SearchResult.class, true);

    static {
        typeDesc.setXmlType(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "SearchResult"));
        org.apache.axis.description.ElementDesc elemField = new org.apache.axis.description.ElementDesc();
        elemField.setFieldName("data");
        elemField.setXmlName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "data"));
        elemField.setXmlType(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "RepositoryNode"));
        elemField.setNillable(true);
        elemField.setItemQName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "item"));
        typeDesc.addFieldDesc(elemField);
        elemField = new org.apache.axis.description.ElementDesc();
        elemField.setFieldName("facettes");
        elemField.setXmlName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "facettes"));
        elemField.setXmlType(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "Facette"));
        elemField.setNillable(true);
        elemField.setItemQName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "item"));
        typeDesc.addFieldDesc(elemField);
        elemField = new org.apache.axis.description.ElementDesc();
        elemField.setFieldName("nodeCount");
        elemField.setXmlName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "nodeCount"));
        elemField.setXmlType(new javax.xml.namespace.QName("http://www.w3.org/2001/XMLSchema", "int"));
        elemField.setNillable(false);
        typeDesc.addFieldDesc(elemField);
        elemField = new org.apache.axis.description.ElementDesc();
        elemField.setFieldName("startIDX");
        elemField.setXmlName(new javax.xml.namespace.QName("http://extension.alfresco.webservices.edu_sharing.org", "startIDX"));
        elemField.setXmlType(new javax.xml.namespace.QName("http://www.w3.org/2001/XMLSchema", "int"));
        elemField.setNillable(false);
        typeDesc.addFieldDesc(elemField);
    }

    /**
     * Return type metadata object
     */
    public static org.apache.axis.description.TypeDesc getTypeDesc() {
        return typeDesc;
    }

    /**
     * Get Custom Serializer
     */
    public static org.apache.axis.encoding.Serializer getSerializer(
           java.lang.String mechType, 
           java.lang.Class _javaType,  
           javax.xml.namespace.QName _xmlType) {
        return 
          new  org.apache.axis.encoding.ser.BeanSerializer(
            _javaType, _xmlType, typeDesc);
    }

    /**
     * Get Custom Deserializer
     */
    public static org.apache.axis.encoding.Deserializer getDeserializer(
           java.lang.String mechType, 
           java.lang.Class _javaType,  
           javax.xml.namespace.QName _xmlType) {
        return 
          new  org.apache.axis.encoding.ser.BeanDeserializer(
            _javaType, _xmlType, typeDesc);
    }

}
