include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-cddns
PKG_VERSION:=1.0.1
PKG_RELEASE:=5

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=CDDNS

LUCI_TITLE:=CDDNS - Tencent Cloud & Alibaba Cloud DDNS client
LUCI_DESCRIPTION:=Lightweight DDNS client for Tencent Cloud (DNSPod) and Alibaba Cloud (Alidns). \
	Pure JS LuCI frontend, shell backend.
LUCI_DEPENDS:=+curl +openssl-util +jsonfilter
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
