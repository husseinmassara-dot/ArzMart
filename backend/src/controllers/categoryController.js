const db = require('../config/db');
const { fileToBase64 } = require('../utils/fileHelper');

exports.getCategories = async (req, res) => {
  try {
    const categories = await db.allAsync(`
      SELECT c.*, p.name_ar as parent_name_ar, p.name_en as parent_name_en 
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.id DESC
    `);
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب التصنيفات', error_en: 'Error fetching categories' });
  }
};

exports.createCategory = async (req, res) => {
  const { name_ar, name_en, parent_id } = req.body;
  const imageUrl = req.file ? fileToBase64(req.file) : '';

  if (!name_ar || !name_en) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال اسم التصنيف باللغتين', error_en: 'Please enter category name in both languages' });
  }

  const pid = parent_id && parent_id !== 'null' ? parseInt(parent_id) : null;

  try {
    const result = await db.runAsync(
      'INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES (?, ?, ?, ?)',
      [name_ar, name_en, pid, imageUrl]
    );
    res.status(201).json({
      message_ar: 'تم إضافة التصنيف بنجاح',
      message_en: 'Category added successfully',
      category: {
        id: result.lastID,
        name_ar,
        name_en,
        parent_id: pid,
        image_url: imageUrl
      }
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error_ar: 'خطأ في إضافة التصنيف', error_en: 'Error adding category' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name_ar, name_en, parent_id } = req.body;
  
  const pid = parent_id && parent_id !== 'null' ? parseInt(parent_id) : null;

  try {
    const category = await db.getAsync('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) {
      return res.status(404).json({ error_ar: 'التصنيف غير موجود', error_en: 'Category not found' });
    }

    // Don't allow setting parent to itself
    if (pid === parseInt(id)) {
      return res.status(400).json({ error_ar: 'لا يمكن تعيين التصنيف كأب لنفسه', error_en: 'Category cannot be its own parent' });
    }

    let imageUrl = category.image_url;
    if (req.file) {
      imageUrl = fileToBase64(req.file) || category.image_url;
    }

    await db.runAsync(
      'UPDATE categories SET name_ar = ?, name_en = ?, parent_id = ?, image_url = ? WHERE id = ?',
      [name_ar, name_en, pid, imageUrl, id]
    );

    res.json({
      message_ar: 'تم تحديث التصنيف بنجاح',
      message_en: 'Category updated successfully',
      category: {
        id: parseInt(id),
        name_ar,
        name_en,
        parent_id: pid,
        image_url: imageUrl
      }
    });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error_ar: 'خطأ في تعديل التصنيف', error_en: 'Error updating category' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await db.getAsync('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) {
      return res.status(404).json({ error_ar: 'التصنيف غير موجود', error_en: 'Category not found' });
    }

    // Delete category
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    // Set parent_id to null for sub-categories or delete them (we use ON DELETE CASCADE in definition, but double safeguard)
    await db.runAsync('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [id]);

    res.json({ message_ar: 'تم حذف التصنيف بنجاح', message_en: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error_ar: 'خطأ في حذف التصنيف', error_en: 'Error deleting category' });
  }
};
