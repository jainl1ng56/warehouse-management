const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');
const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Get all devices
app.get('/api/devices', (req, res) => {
  db.query('SELECT * FROM devices', (error, results) => {
    if (error) {
      console.error('Error fetching devices:', error);
      res.status(500).send('Error fetching devices');
    } else {
      res.json(results);
    }
  });
});

// Add a new device
app.post('/api/devices', (req, res) => {
  const { owner, date, name, model, count, project, location } = req.body;
  const query = 'INSERT INTO devices (owner, date, name, model, count, project, location) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const values = [owner, date, name, model, count, project, location];

  db.query(query, values, (error, results) => {
    if (error) {
      console.error('Error adding device:', error);
      res.status(500).send('Error adding device');
    } else {
      const newDeviceId = results.insertId; // 获取插入的设备ID
      const newDevice = { id: newDeviceId, owner, date, name, model, count, project, location };

      // 更新 total 表中的 receivedcount, HuYao, GDL 和 NaQing
      const updateQuery = `
        UPDATE total
        SET 
          receivedcount = (
            SELECT IFNULL(SUM(count), 0)
            FROM devices
            WHERE name = ? AND model = ?
          ),
          HuYao = (
            SELECT IFNULL(SUM(count), 0)
            FROM devices
            WHERE name = ? AND location = 'HuYao'
          ),
          GDL = (
            SELECT IFNULL(SUM(count), 0)
            FROM devices
            WHERE name = ? AND location = 'GDL'
          ),
          NaQing = receivedcount - HuYao - GDL
        WHERE name = ? AND model = ?
      `;
      const updateValues = [name, model, name, name, name, name, model];

      db.query(updateQuery, updateValues, (updateError, updateResults) => {
        if (updateError) {
          console.error('Error updating total:', updateError);
          res.status(500).send('Error updating total');
        } else {
          res.json(newDevice); // 返回包含设备ID的设备对象
        }
      });
    }
  });
});

// Delete a device
app.delete('/api/devices/:id', (req, res) => {
  const deviceId = req.params.id;

  // 在删除设备前，先获取设备信息
  db.query('SELECT * FROM devices WHERE id = ?', [deviceId], (error, results) => {
    if (error) {
      console.error('Error fetching device:', error);
      res.status(500).send('Error fetching device');
    } else if (results.length === 0) {
      res.status(404).send('Device not found');
    } else {
      const device = results[0];

      const deleteRecordQuery = 'INSERT INTO trash (owner, date, name, model, count, project, location) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const deleteRecordValues = [device.owner, device.date, device.name, device.model, device.count, device.project, device.location];

      db.query(deleteRecordQuery, deleteRecordValues, (deleteRecordError) => {
        if (deleteRecordError) {
          console.error('Error inserting into trash:', deleteRecordError);
          res.status(500).send('Error inserting into trash');
        } else {
          // 删除设备记录
          db.query('DELETE FROM devices WHERE id = ?', [deviceId], (deleteError, deleteResults) => {
            if (deleteError) {
              console.error('Error deleting device:', deleteError);
              res.status(500).send('Error deleting device');
            } else {
              // 更新 total 表中的 receivedcount, HuYao, GDL 和 NaQing
              const updateQuery = `
                UPDATE total
                SET 
                  receivedcount = (
                    SELECT IFNULL(SUM(count), 0)
                    FROM devices
                    WHERE name = ? AND model = ?
                  ),
                  HuYao = (
                    SELECT IFNULL(SUM(count), 0)
                    FROM devices
                    WHERE name = ? AND location = 'HuYao'
                  ),
                  GDL = (
                    SELECT IFNULL(SUM(count), 0)
                    FROM devices
                    WHERE name = ? AND location = 'GDL'
                  ),
                  NaQing = receivedcount - HuYao - GDL
                WHERE name = ? AND model = ?
              `;
              const updateValues = [device.name, device.model, device.name, device.name, device.name, device.name, device.model];

              db.query(updateQuery, updateValues, (updateError, updateResults) => {
                if (updateError) {
                  console.error('Error updating total:', updateError);
                  res.status(500).send('Error updating total');
                } else {
                  res.sendStatus(200);
                }
              });  
            } 
          });
        }
      });
    }
  });
});

// Search devices
app.get('/api/search', (req, res) => {
  const { owner, date, name, model, project, location } = req.query;
  let query = 'SELECT * FROM devices WHERE 1=1';
  const values = [];

  if (owner) {
    query += ' AND owner LIKE ?';
    values.push(`%${owner}%`);
  }
  if (date) {
    query += ' AND date = ?';
    values.push(date);
  }
  if (name) {
    query += ' AND name LIKE ?';
    values.push(`%${name}%`);
  }
  if (model) {
    query += ' AND model LIKE ?';
    values.push(`%${model}%`);
  }
  if (project) {
    query += ' AND project LIKE ?';
    values.push(`%${project}%`);
  }
  if (location) {
    query += ' AND location LIKE ?';
    values.push(`%${location}%`);
  }

  db.query(query, values, (error, results) => {
    if (error) {
      console.error('Error searching devices:', error);
      res.status(500).send('Error searching devices');
    } else {
      res.json(results);
    }
  });
});

// Update total table
app.post('/api/updateTotal', (req, res) => {
  const updateQuery = `
    UPDATE total
    SET 
      receivedcount = (
        SELECT IFNULL(SUM(count), 0)
        FROM devices
        WHERE total.name = devices.name AND total.model = devices.model
      ),
      HuYao = (
        SELECT IFNULL(SUM(count), 0)
        FROM devices
        WHERE total.name = devices.name AND location = 'HuYao'
      ),
      GDL = (
        SELECT IFNULL(SUM(count), 0)
        FROM devices
        WHERE total.name = devices.name AND location = 'GDL'
      ),
      NaQing = receivedcount - HuYao - GDL
  `;

  db.query(updateQuery, (error, results) => {
    if (error) {
      console.error('Error updating total:', error);
      res.status(500).send('Error updating total');
    } else {
      res.send('Total updated successfully');
    }
  });
});

// Get total table
app.get('/api/totals', (req, res) => {
  db.query('SELECT * FROM total', (error, results) => {
    if (error) {
      console.error('Error fetching totals:', error);
      res.status(500).send('Error fetching totals');
    } else {
      res.json(results);
    }
  });
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
