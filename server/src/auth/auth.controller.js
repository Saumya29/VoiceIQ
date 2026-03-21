import axios from 'axios';
import { config } from '../config/env.js';
import InstallationsDao from './installations.dao.js';

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

const AuthController = {
  // Redirects to HighLevel's OAuth consent screen
  install(req, res) {
    if (!config.ghl.installUrl) {
      return res.status(500).json({
        error: 'GHL_INSTALL_URL not configured. Copy the Install URL from your HighLevel Marketplace app settings → Auth → Advanced Settings.',
      });
    }

    res.redirect(config.ghl.installUrl);
  },

  // HighLevel redirects here after user approves
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

      // Save installation
      InstallationsDao.upsert({
        locationId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        companyName,
      });

      // Redirect to the frontend dashboard with the locationId
      res.redirect(`http://localhost:5173/?locationId=${locationId}`);
    } catch (error) {
      console.error('OAuth callback error:', error.response?.data || error.message);
      next(error);
    }
  },

  // Check if a location has a valid installation
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
};

export default AuthController;
