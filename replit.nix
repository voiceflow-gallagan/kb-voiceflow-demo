{ pkgs }: {
	deps = [
		pkgs.nodejs-18_x
		pkgs.glib
		pkgs.chromedriver
    pkgs.chromium
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
	  pkgs.python311
	
  ];
}
