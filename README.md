Vmware Index

base url: https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/

replace https://softwareupdate.vmware.com with new base url.

there are some xml files, each one represent a product:

- ${baseUrl}/fusion-arm64.xml
- ${baseUrl}/fusion-universal.xml
- ${baseUrl}/fusion.xml
- ${baseUrl}/player-linux.xml
- ${baseUrl}/player-windows.xml
- ${baseUrl}/vmrc-linux.xml
- ${baseUrl}/vmrc-macos.xml
- ${baseUrl}/vmrc-windows.xml
- ${baseUrl}/ws-linux.xml
- ${baseUrl}/ws-windows.xml

example content for fusion-arm64.xml

``` xml
<metaList>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>12.0.0</version>
    <url>fusion/12.2.3/19436697/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>13.0.0</version>
    <url>fusion/13.0.0/20802013/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>12.0.0</version>
    <url>fusion/12.2.5/20904517/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>12.0.0</version>
    <url>fusion/12.2.1/18811640/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>12.0.0</version>
    <url>fusion/12.2.0/18760249/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>12.0.0</version>
    <url>fusion/12.2.4/20071091/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
</metaList>
```

example content for ws-windows.xml

``` xml
<metaList>
  <metadata>
    <productId>ws-windows</productId>
    <version>12.5.8</version>
    <url>ws/12.5.8/7098237/windows/packages/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>ws-windows</productId>
    <version>15.0.0</version>
    <url>ws/15.5.0/14665864/windows/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <metadata>
    <productId>ws-windows</productId>
    <version>16.0.0</version>
    <url>ws/16.2.2/19200509/windows/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
</metaList>
```


This project simply exact these xml files and generate full urls for each product.

### workstation/fusion:

windows: 

https://softwareupdate.vmware.com/cds/vmw-desktop/ws/17.6.3/24583834/windows/core/VMware-workstation-17.6.3-24583834.exe.tar

linux:

https://softwareupdate.vmware.com/cds/vmw-desktop/ws/17.5.2/23775571/linux/core/VMware-Workstation-17.5.2-23775571.x86_64.bundle.tar

macos: 

https://softwareupdate.vmware.com/cds/vmw-desktop/fusion/13.0.2/21581413/universal/core/com.vmware.fusion.zip.tar
https://softwareupdate.vmware.com/cds/vmw-desktop/fusion/12.2.4/20071091/x86/core/com.vmware.fusion.zip.tar
https://softwareupdate.vmware.com/cds/vmw-desktop/fusion/12.2.0/18760249/arm64/core/com.vmware.fusion.zip.tar

### Player

linux: 
https://softwareupdate.vmware.com/cds/vmw-desktop/player/17.6.0/24238078/linux/core/VMware-Player-17.6.0-24238078.x86_64.bundle.tar

windows:
https://softwareupdate.vmware.com/cds/vmw-desktop/player/17.5.2/23775571/windows/core/VMware-player-17.5.2-23775571.exe.tar

### tools

https://softwareupdate.vmware.com/cds/vmw-desktop/ws/17.6.0/24238078/windows/packages/tools-windows-x86.tar
https://softwareupdate.vmware.com/cds/vmw-desktop/ws/16.2.1/18811642/linux/packages/vmware-tools-linux-11.3.5-18557794.x86_64.component.tar
https://softwareupdate.vmware.com/cds/vmw-desktop/fusion/11.0.3/12992109/packages/com.vmware.fusion.tools.linux.zip.tar