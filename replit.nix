{ pkgs }: {
    deps = [
    	pkgs.nodejs-18_x
    	pkgs.yarn
    	pkgs.python311
    	pkgs.chromedriver
    	pkgs.chromium
    	pkgs.glib
    	pkgs.nss
    	pkgs.fontconfig
  ];
}
