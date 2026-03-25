import axios from 'axios';
import CryptoJS from 'crypto-js';
import { config } from '../config/env.js';
import InstallationsDao from './installations.dao.js';

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

const AuthController = {
  install(req, res) {
    if (!config.ghl.installUrl) {
      return res.status(500).json({
        error: 'GHL_INSTALL_URL not configured. Copy the Install URL from your HighLevel Marketplace app settings → Auth → Advanced Settings.',
      });
    }

    res.redirect(config.ghl.installUrl);
  },

  async callback(req, res, next) {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
      }

      // Exchange code for tokens (HighLevel requires form-urlencoded)
      const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
        client_id: config.ghl.clientId,
        client_secret: config.ghl.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.ghl.redirectUri,
        user_type: 'Location',
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const {
        access_token,
        refresh_token,
        expires_in,
        locationId,
        companyName,
      } = tokenResponse.data;

      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      InstallationsDao.upsert({
        locationId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        companyName,
      });

      const appUrl = config.ghl.appUrl || 'http://localhost:5173';
      res.redirect(`${appUrl}/?locationId=${locationId}`);
    } catch (error) {
      console.error('OAuth callback error:', error.response?.data || error.message);
      next(error);
    }
  },

  status(req, res) {
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    const installation = InstallationsDao.getByLocationId(locationId);
    res.json({
      installed: !!installation,
      locationId,
      companyName: installation?.company_name || null,
    });
  },

  // Decrypt GHL SSO payload sent from Custom Page iframe.
  // GHL encrypts user context with AES using the app's SSO key.
  // The frontend gets the encrypted payload via postMessage from GHL parent,
  // then sends it here for server-side decryption (SSO key must never be exposed client-side).
  async ssoDecrypt(req, res, next) {
    try {
      const { encryptedData } = req.body;

      if (!encryptedData) {
        return res.status(400).json({ error: 'encryptedData is required' });
      }

      if (!config.ghl.ssoKey) {
        return res.status(500).json({ error: 'GHL_SSO_KEY not configured' });
      }

      const decrypted = CryptoJS.AES.decrypt(encryptedData, config.ghl.ssoKey)
        .toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        return res.status(401).json({ error: 'Failed to decrypt SSO data' });
      }

      const userData = JSON.parse(decrypted);
      const locationId = userData.activeLocation;

      if (!locationId) {
        return res.status(400).json({ error: 'No active location in SSO data' });
      }

      const installation = InstallationsDao.getByLocationId(locationId);

      res.json({
        success: true,
        user: {
          userId: userData.userId,
          email: userData.email,
          role: userData.role,
          companyId: userData.companyId,
        },
        locationId,
        installed: !!installation,
        companyName: installation?.company_name || null,
      });
    } catch (error) {
      console.error('SSO decrypt error:', error.message);
      next(error);
    }
  },
};

export default AuthController;
